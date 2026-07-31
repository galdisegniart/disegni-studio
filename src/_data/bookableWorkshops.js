const workshops = require("./workshops.js");

module.exports = () => {
  return workshops().filter((w) => w.availableSlots && w.availableSlots.length);
};
