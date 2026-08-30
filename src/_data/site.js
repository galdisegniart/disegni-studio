// site.json used to be the Eleventy global data file directly; it's now
// renamed to site-content.json (the file Decap actually edits, in its native
// i18n shape) so this wrapper can flatten it back to the flat shape every
// template already expects, without colliding with Eleventy's own
// filename-based global data key "site".
const raw = require("./site-content.json");
const flattenLocale = require("../_lib/flattenLocale.js");

module.exports = () => flattenLocale(raw);
