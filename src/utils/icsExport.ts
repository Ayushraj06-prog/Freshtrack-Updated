/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * RFC-5545 .ics Calendar Exporter for FreshTrack Expiry Alerts.
 * Imports seamlessly into Google Calendar, Apple Calendar, and Outlook for native lock-screen reminders.
 */

import { InventoryItem } from '../types/inventory';
import { getRemainingDays } from '../data/shelfLifeData';

function formatIcsDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function escapeIcsText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function exportExpiryCalendarIcs(items: InventoryItem[], horizonDays = 14): number {
  const upcoming = items
    .filter((i) => i.status === 'active')
    .filter((i) => {
      const rem = getRemainingDays(i.estimatedExpiryDate);
      return rem >= -1 && rem <= horizonDays;
    })
    .sort((a, b) => a.estimatedExpiryDate.localeCompare(b.estimatedExpiryDate));

  if (upcoming.length === 0) return 0;

  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FreshTrack India//Kitchen Expiry Alerts//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:FreshTrack Kitchen Expiries',
  ];

  for (const item of upcoming) {
    const startDay = formatIcsDate(item.estimatedExpiryDate);
    // Next day for all-day event DTEND
    const endDateObj = new Date(item.estimatedExpiryDate + 'T00:00:00');
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endDay = formatIcsDate(endDateObj.toISOString().split('T')[0]);

    const summary = escapeIcsText(`Use By Today: ${item.name} (${item.quantity} ${item.unit})`);
    const desc = escapeIcsText(
      `FreshTrack FIFO Alert — ${item.name} in ${item.storage}${
        item.branchZone ? ` (${item.branchZone})` : ''
      }${item.batchCode ? ` | Lot: ${item.batchCode}` : ''}${
        item.price ? ` | Value: Rs.${item.price}` : ''
      }. Open FreshTrack to cook or freeze before spoilage.`
    );

    lines.push(
      'BEGIN:VEVENT',
      `UID:freshtrack-${item.id}@freshtrack.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${startDay}`,
      `DTEND;VALUE=DATE:${endDay}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:Cook or freeze ${escapeIcsText(item.name)} before it expires!`,
      'TRIGGER:-PT16H',
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `freshtrack_expiry_alerts_${new Date().toISOString().split('T')[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return upcoming.length;
}
