const workshops = require("./workshops.js");
const site = require("./site.json");

// Latest time a session may START. Slots beginning after this are never
// offered in the calendar and are rejected by the Worker.
const DEFAULT_MAX_START_TIME = "18:30";

module.exports = () => {
  const manifest = {
    maxStartTime: site.bookingMaxStartTime || DEFAULT_MAX_START_TIME,
    workshops: {},
  };

  workshops()
    .filter((w) => w.recurringAvailability && w.recurringAvailability.length)
    .forEach((w) => {
      manifest.workshops[w.slug] = {
        windowWeeks: Number(w.bookingWindowWeeks) || 8,
        rules: w.recurringAvailability.map((rule) => ({
          weekday: Number(rule.weekday),
          time: rule.time,
        })),
      };
    });

  return manifest;
};
