# Holidays

import useBaseUrl from "@docusaurus/useBaseUrl";

<div className="video-container" style={{"textAlign": "center", "marginBottom": "2em"}}>
  <video
    controls
    autoPlay
    loop
    muted
    playsInline
    style={{"width": "100%", "maxWidth": "800px", "borderRadius": "8px"}}
  >
    <source src={useBaseUrl("/video/Holidays.webm")} type="video/webm" />
    Your browser does not support the video tag.
  </video>
</div>

Display public holidays on your calendar with automatic detection based on your country, state, and region.

## Overview

The holiday feature integrates directly with your calendar, showing holidays as all-day events without creating any files in your vault. Holidays are automatically calculated using the `date-holidays` library, which works completely offline.

## Configuration

Navigate to **Settings → Your Calendar Name → General** (scroll to the bottom) to configure holiday display.

### Basic Settings

**Enable holidays**
- Toggle to show or hide holidays on your calendar
- Default: `false` (disabled)

**Country**
- ISO country code (e.g., `US`, `GB`, `DE`, `CA`)
- Required for holiday detection
- Default: `US`

**State/Province** *(Optional)*
- State or province code for regional holidays
- Examples: `ca` (California), `ny` (New York), `on` (Ontario), `by` (Bavaria)
- Leave empty for national holidays only

**Region** *(Optional)*
- More specific region code for localized holidays
- Used for cities or districts with unique holiday calendars

### Holiday Types

Choose which types of holidays to display:

| Option | Includes |
|--------|----------|
| **Public holidays only** | Official public holidays |
| **Public + Bank holidays** | Public and banking holidays |
| **Public + Bank + Observance** | Public, bank, and observance days |
| **All except optional** | Public, bank, observance, and school holidays |
| **All types** | Every holiday type including optional ones |

**Timezone** *(Optional)*
- Specify timezone for holiday calculations
- Examples: `America/New_York`, `Europe/London`, `Asia/Tokyo`
- Leave empty to use system timezone

## Examples

### United States (National)
```
Country: US
State: (leave empty)
Types: Public holidays only
```
Displays: New Year's Day, Independence Day, Thanksgiving, Christmas, etc.

### United States (California)
```
Country: US
State: ca
Types: Public holidays only
```
Displays: National holidays plus California-specific holidays

### United Kingdom
```
Country: GB
Types: Public + Bank holidays
```
Displays: National holidays, bank holidays, royal events

### Germany (Bavaria)
```
Country: DE
State: by
Types: Public + Bank + Observance
```
Displays: National German holidays plus Bavarian regional holidays

### Canada (Ontario)
```
Country: CA
State: on
Types: Public holidays only
```
Displays: National Canadian holidays plus Ontario provincial holidays

## How It Works

### Virtual Events
- Holidays appear as all-day virtual events on your calendar
- They don't create any files in your vault
- They're marked with `isVirtual: true` in the calendar data
- Holiday metadata is stored in the event's `meta` property

### Caching
- Holidays are cached per year for fast access
- Cache is stored in Obsidian's local storage
- Cache expires after 30 days
- When you change settings, the cache is automatically cleared

### Performance
- Works completely offline - no internet connection required
- Uses the `date-holidays` npm library for accurate calculations
- Minimal performance impact - holidays are loaded only for visible date ranges

## Holiday Properties

Each holiday event has the following properties:

- **ID**: Unique identifier in format `date-holidays:YYYY-MM-DD:Holiday Name`
- **Title**: Holiday name (e.g., "Christmas Day", "Independence Day")
- **Date**: ISO date string (YYYY-MM-DD)
- **All Day**: Always `true`
- **Virtual**: Always `true` (not backed by a file)
- **Meta**:
  - `holidayType`: Type of holiday (public, bank, school, observance, optional)
  - `holidaySource`: Always `"date-holidays"`

## Filtering

Holiday events respect your calendar's filter settings:
- They appear in filtered event lists
- They're excluded from statistics (duration tracking, etc.)
- They don't appear in search results (since they have no backing files)

## Limitations

- Holidays are read-only - you cannot edit or delete them via the calendar
- Holiday calculations are based on the `date-holidays` library's data
- Some countries/regions may have incomplete or outdated holiday information
- Changes to holiday settings require a calendar refresh to take effect

## Country Codes

Common country codes:
- **US** - United States
- **GB** - United Kingdom
- **DE** - Germany (Deutschland)
- **FR** - France
- **CA** - Canada
- **AU** - Australia
- **JP** - Japan
- **IN** - India
- **BR** - Brazil
- **MX** - Mexico
- **IT** - Italy
- **ES** - Spain
- **NL** - Netherlands
- **SE** - Sweden
- **NO** - Norway
- **DK** - Denmark
- **FI** - Finland
- **PL** - Poland
- **CH** - Switzerland

For a complete list of supported countries, see the [date-holidays library documentation](https://www.npmjs.com/package/date-holidays).
