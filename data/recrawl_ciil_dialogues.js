#!/usr/bin/env node
/**
 * Re-crawl CIIL programme pages to extract Kashmiri + English dialogue pairs
 * and update ciil_structured_context.json with richer data.
 */

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'ciil_structured_context.json');

async function fetchPage(url) {
  const resp = await fetch(url, {
    headers: {
      'Referer': 'https://koshur.org/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    },
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

/**
 * Parse the main content area of a CIIL programme page.
 * Returns an array of sections, each with title and items.
 * Items in dialogue sections will be objects { kashmiri, english, speaker }.
 * Items in vocabulary/table sections will be strings "kashmiri - english".
 * Other items are plain strings.
 */
function parsePageContent(html) {
  // Strip navigation, header, and footer
  // The main content is typically between the audio link and the footer nav
  let content = html;

  // Remove everything before the main content (nav, header, cover image)
  const audioMarker = content.indexOf('Click here for audio');
  if (audioMarker > -1) {
    content = content.substring(audioMarker);
  }

  // Remove footer (starts with "Previous Article" or navigation images)
  const footerMarkers = ['Previous Article', 'prevart.gif', 'nextart.gif', 'koshursite_index'];
  for (const marker of footerMarkers) {
    const idx = content.indexOf(marker);
    if (idx > -1) {
      content = content.substring(0, idx);
      break;
    }
  }

  // Remove HTML tags but preserve structure
  // First, convert <br> and block elements to newlines
  content = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|tr|li|h[1-6])[^>]*>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<\/td>/gi, '')
    .replace(/<\/?table[^>]*>/gi, '\n')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<i>(.*?)<\/i>/gi, '_$1_')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // Split into sections based on Roman numerals or bold headings
  const sections = [];
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  let currentSection = null;

  for (const line of lines) {
    // Skip "Click here for audio" and similar
    if (/^Click here for audio$/i.test(line)) continue;
    if (/^\*\*Programme \d+\*\*$/i.test(line)) continue;

    // Detect section headers (Roman numerals or bold text at start)
    const sectionMatch = line.match(/^\*?\*?([IVXLC]+)\.\s*(.*?)\*?\*?$/);
    if (sectionMatch) {
      currentSection = {
        title: sectionMatch[2].trim() || `Section ${sectionMatch[1]}`,
        items: [],
        type: 'text',
      };
      sections.push(currentSection);
      continue;
    }

    // Detect bold section titles
    const boldMatch = line.match(/^\*\*(.*?)\*\*$/);
    if (boldMatch && boldMatch[1].length < 80) {
      currentSection = {
        title: boldMatch[1].trim(),
        items: [],
        type: 'text',
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      currentSection = { title: 'Introduction', items: [], type: 'text' };
      sections.push(currentSection);
    }

    currentSection.items.push(line.replace(/\*\*/g, ''));
  }

  return sections;
}

/**
 * Detect if a section contains dialogue (speaker labels like A:, R:, G:)
 * and try to extract Kashmiri + English pairs
 */
function classifySection(section) {
  const items = section.items;

  // Check for speaker labels
  const speakerPattern = /^([A-Z][a-z]*|[A-Z])\s*:\s*/;
  const hasSpeakers = items.filter(i => speakerPattern.test(i)).length > items.length * 0.3;

  if (hasSpeakers) {
    return { ...section, type: 'dialogue' };
  }

  // Check for vocabulary (word - translation pattern)
  const hasDashes = items.filter(i => /\s+-\s+/.test(i)).length > items.length * 0.5;
  if (hasDashes) {
    return { ...section, type: 'vocabulary' };
  }

  // Check for table-like content (pipe separators)
  const hasPipes = items.filter(i => i.includes(' | ')).length > items.length * 0.3;
  if (hasPipes) {
    return { ...section, type: 'table' };
  }

  // Check for numbered items
  const hasNumbers = items.filter(i => /^\d+[\.\)]\s/.test(i)).length > items.length * 0.3;
  if (hasNumbers) {
    return { ...section, type: 'numbered' };
  }

  return section;
}

async function processAllProgrammes() {
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let updated = 0;

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    if (!entry.pageUrl) continue;

    const progNum = entry.lessonId.replace('ciil-prog', '');
    process.stdout.write(`Processing Programme ${progNum}... `);

    try {
      const html = await fetchPage(entry.pageUrl);
      const rawSections = parsePageContent(html);
      const sections = rawSections.map(classifySection);

      // Build improved sections for the context data
      const newSections = [];
      let intro = '';

      for (const section of sections) {
        // Clean up title
        let title = section.title
          .replace(/^\*\*/g, '').replace(/\*\*$/g, '')
          .replace(/^[\s:]+|[\s:]+$/g, '')
          .trim();

        if (!title || title === 'Introduction') {
          // Merge into intro
          intro = section.items.join(' ').trim();
          continue;
        }

        const cleanItems = section.items
          .map(item => item.replace(/\*\*/g, '').trim())
          .filter(Boolean)
          .filter(item => item.length > 1);

        if (cleanItems.length === 0) continue;

        // For dialogue sections, try to pair Kashmiri lines with English
        if (section.type === 'dialogue') {
          const dialogueItems = [];
          for (let j = 0; j < cleanItems.length; j++) {
            const line = cleanItems[j];
            // Try to find "speaker: kashmiri text" = "english text" pattern
            // Or "speaker: kashmiri (english)" pattern
            const speakerMatch = line.match(/^([A-Z][a-z]*|[A-Z])\s*:\s*(.*)/);
            if (speakerMatch) {
              const speaker = speakerMatch[1];
              let rest = speakerMatch[2];

              // Check if there's a = separator (kashmiri = english)
              const eqParts = rest.split(/\s*=\s*/);
              if (eqParts.length >= 2) {
                dialogueItems.push({
                  speaker,
                  kashmiri: eqParts[0].trim().replace(/^["']|["']$/g, ''),
                  english: eqParts.slice(1).join(' = ').trim().replace(/^["']|["']$/g, ''),
                });
              } else {
                // Check if the next line is the English translation (no speaker label)
                const nextLine = cleanItems[j + 1];
                if (nextLine && !nextLine.match(/^([A-Z][a-z]*|[A-Z])\s*:/)) {
                  dialogueItems.push({
                    speaker,
                    kashmiri: rest.trim().replace(/^["']|["']$/g, ''),
                    english: nextLine.trim().replace(/^["']|["']$/g, ''),
                  });
                  j++; // Skip next line
                } else {
                  // Just English, no Kashmiri available
                  dialogueItems.push({
                    speaker,
                    kashmiri: '',
                    english: rest.trim().replace(/^["']|["']$/g, ''),
                  });
                }
              }
            } else {
              dialogueItems.push({
                speaker: '',
                kashmiri: '',
                english: line.replace(/^["']|["']$/g, ''),
              });
            }
          }

          newSections.push({
            title,
            type: 'dialogue',
            items: dialogueItems.map(d => {
              if (d.kashmiri) {
                return `${d.speaker ? d.speaker + ': ' : ''}${d.kashmiri} = ${d.english}`;
              }
              return `${d.speaker ? d.speaker + ': ' : ''}${d.english}`;
            }),
          });
        } else {
          newSections.push({
            title,
            items: cleanItems,
          });
        }
      }

      // Update the entry
      if (intro) entry.intro = intro;
      if (newSections.length > 0) entry.sections = newSections;

      updated++;
      console.log(`OK (${newSections.length} sections)`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 800));
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log(`\nDone. Updated ${updated} programmes.`);
}

processAllProgrammes().catch(console.error);
