const workshops = require("./workshops.js");

module.exports = () => {
  return workshops().filter((w) => w.recurringAvailability && w.recurringAvailability.length);
};
