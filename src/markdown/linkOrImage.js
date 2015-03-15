'use strict';

var once = require('../once');
var strings = require('../strings');
var parseLinkInput = require('../chunks/parseLinkInput');
var rdefinitions = /^[ ]{0,3}\[(\d+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|$)/gm;

function extractDefinitions (text, definitions) {
  rdefinitions.lastIndex = 0;
  return text.replace(rdefinitions, replacer);

  function replacer (all, id, link, newlines, title) {
    definitions[id] = all.replace(/\s*$/, '');
    if (newlines) {
      definitions[id] = all.replace(/["(](.+?)[")]$/, '');
      return newlines + title;
    }
    return '';
  }
}

function pushDefinition (chunks, definition) {
  var regex = /(\[)((?:\[[^\]]*\]|[^\[\]])*)(\][ ]?(?:\n[ ]*)?\[)(\d+)(\])/g;
  var anchor = 0;
  var definitions = {};
  var footnotes = '';

  chunks.before = extractDefinitions(chunks.before, definitions);
  chunks.selection = extractDefinitions(chunks.selection, definitions);
  chunks.after = extractDefinitions(chunks.after, definitions);
  chunks.before = chunks.before.replace(regex, getLink);

  if (definition) {
    pushAnchor(definition);
  } else {
    chunks.selection = chunks.selection.replace(regex, getLink);
  }

  var result = anchor;

  chunks.after = chunks.after.replace(regex, getLink);

  if (chunks.after) {
    chunks.after = chunks.after.replace(/\n*$/, '');
  }
  if (!chunks.after) {
    chunks.selection = chunks.selection.replace(/\n*$/, '');
  }

  chunks.after += '\n\n' + footnotes;

  return result;

  function pushAnchor (definition) {
    anchor++;
    definition = definition.replace(/^[ ]{0,3}\[(\d+)\]:/, '  [' + anchor + ']:');
    footnotes += '\n' + definition;
  }

  function getLink (all, before, inner, afterInner, id, end) {
    inner = inner.replace(regex, getLink);
    if (definitions[id]) {
      pushAnchor(definitions[id]);
      return before + inner + afterInner + anchor + end;
    }
    return all;
  }
}

function linkOrImage (chunks, options, type) {
  var image = type === 'image';
  var resume;

  chunks.trim();
  chunks.findTags(/\s*!?\[/, /\][ ]?(?:\n[ ]*)?(\[.*?\])?/);

  if (chunks.endTag.length > 1 && chunks.startTag.length > 0) {
    chunks.startTag = chunks.startTag.replace(/!?\[/, '');
    chunks.endTag = '';
    pushDefinition(chunks);
    return;
  }

  chunks.selection = chunks.startTag + chunks.selection + chunks.endTag;
  chunks.startTag = chunks.endTag = '';

  if (/\n\n/.test(chunks.selection)) {
    pushDefinition(chunks);
    return;
  }
  resume = this.async();

  options.prompts.close();
  (options.prompts[type] || options.prompts.link)(once(resolved));

  function resolved (text) {
    var link = parseLinkInput(text);
    if (link.href.length === 0) {
      resume(); return;
    }

    chunks.selection = (' ' + chunks.selection).replace(/([^\\](?:\\\\)*)(?=[[\]])/g, '$1\\').substr(1);

    var definition = ' [9999]: ' + link.href + (link.title ? ' "' + link.title + '"' : '');
    var anchor = pushDefinition(chunks, definition);

    chunks.startTag = image ? '![' : '[';
    chunks.endTag = '][' + anchor + ']';

    if (!chunks.selection) {
      chunks.selection = strings.placeholders[type];
    }
    resume();
  }
}

module.exports = linkOrImage;
