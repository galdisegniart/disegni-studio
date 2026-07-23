const { execSync } = require("child_process");

module.exports = () => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch (e) {
    return Date.now();
  }
};
