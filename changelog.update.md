### Improved

- In the stacked layout for overlapping timed events (**Allow slot event overlap**, on by default), each covered event's title wraps into the part that stays visible instead of running under the event in front of it, the way Google Calendar and Notion Calendar keep every title readable.

### Fixed

- **Allow event overlap** and **Allow slot event overlap** describe what they actually do: the first decides whether you can drop or resize an event onto an occupied time, the second how overlapping events are drawn. With **Allow event overlap** off, an event that already overlaps another can still be moved out of it, and both settings apply to an open calendar straight away.
- The "+N more" link in week and day views uses your theme's colours instead of a light grey box with near-white text that was unreadable in dark themes.
