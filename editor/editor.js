function insertCaret(elem) {
  elem.find('.fake-caret').remove();
  if (!elem.parent().find('.caret').length) {
    elem.parent().append($('<div class="caret">'))
  }
  var sel, range;
  if (window.getSelection) {
      // IE9 and non-IE
      sel = window.getSelection();
      if (sel.getRangeAt && sel.rangeCount) {
          range = sel.getRangeAt(0);
          //range.deleteContents();

          // Range.createContextualFragment() would be useful here but is
          // only relatively recently standardized and is not supported in
          // some browsers (IE9, for one)
          var el = document.createElement("span");
          el.innerHTML = '<span class="fake-caret"></span>';
          var frag = document.createDocumentFragment(), node, lastNode;
          while ( (node = el.firstChild) ) {
              lastNode = frag.appendChild(node);
          }
          range.insertNode(frag);

          var position = elem.find('.fake-caret').position();
          elem.find('.fake-caret').remove();
          elem.parent().find('.caret').css(position);

          // TODO: fix selection
          // Preserve the selection
          /*if (lastNode) {
              range = range.cloneRange();
              range.setStartAfter(lastNode);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
          }*/
      }
  } else if (document.selection && document.selection.type != "Control") {
      // IE < 9
      document.selection.createRange().pasteHTML('<span class="caret"></span>');
  }
}

function save_file(filename, data) {
    var blob = new Blob([data], {type: 'text/clio'});
    if(window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, filename);
    }
    else{
        var elem = window.document.createElement('a');
        elem.href = window.URL.createObjectURL(blob);
        elem.download = filename;
        document.body.appendChild(elem);
        elem.click();
        document.body.removeChild(elem);
    }
}

jQuery.fn.extend({
  clio_editor: function() {
    function colorize_text(text) {
      var colorized = $('<div>');
      var patterns = [
        {pattern: /^fn +[a-z_][a-z_0-9]*/i, action: function (match, elems) {
            var name = match.slice(2).trim(' ');
            var spaces = match.length - name.length - 2;
            elems.append($('<span>').addClass('keyword').text('fn'));
            elems.append($('<span>').addClass('white-space').text(' '.repeat(spaces)));
            elems.append($('<span>').addClass('variable').text(name));
          }
        },
        {pattern: /^type +[a-z_][a-z_0-9]*/i, action: function (match, elems) {
            var name = match.slice(4).trim(' ');
            var spaces = match.length - name.length - 4;
            elems.append($('<span>').addClass('keyword').text('type'));
            elems.append($('<span>').addClass('white-space').text(' '.repeat(spaces)));
            elems.append($('<span>').addClass('variable').text(name));
          }
        },
        /*
        {pattern: /^=> +[a-z_][a-z_0-9]*('s? )?/i, action: function (match, elems) {
            var name = match.slice(2).trim(' ');
            var spaces = match.length - name.length - 2;
            elems.append($('<span>').addClass('operator').text('=>'));
            elems.append($('<span>').addClass('white-space').text(' '.repeat(spaces)));
            elems.append($('<span>').addClass('variable').text(name));
          }
        },*/
        {class: 'comment', pattern: /^--.*?($|\n)/},
        {class: 'string', pattern: /^#[^\[\] \r\n]+/i},
        {class: 'keyword', pattern: /^(fn|if|else|elif|return|not|or|and|transform|import)(?![a-zA-Z_-])/},
        {class: 'builtin', pattern: /^(print|upper|map|pow|mul|add|div|sub)(?![a-zA-Z_-])/},
        {class: 'literal', pattern: /^(true|false)/},
        {class: 'operator', pattern: /^(->|=>)/},
        {class: 'comparison', pattern: /^(!|!=|=|>|<|>=|<=)/},
        {class: 'grouping', pattern: /^([\[\]()])/},
        {class: 'math', pattern: /^[-+/*%^]/},
        {class: 'special', pattern: /^(([@][a-z][a-z0-9_]*)|[.:@])/i},
        {class: 'number', pattern: /^(0|-?[1-9][0-9']*)(\.[0-9']+)?/},
        {class: 'symbol', pattern: /^[a-z_][a-z_0-9]*('s? )?/i},
        {class: 'string', pattern: /^('([^\\]|\\.)*?'|:\S+)/},
        {class: 'string', pattern: /^https?:[^ \r\n]+/},
        {class: 'not-classified', pattern: /^\S+/},
        {class: 'new-line', pattern: /^(\r\n|[\r\n])/},
        {class: 'white-space', pattern: /\s+/},
      ];
      var i = 0;
      while (i <= text.length) {
        for (var j = 0; j < patterns.length; j++) {
          var match = text.slice(i).match(patterns[j].pattern);
          if (match != null) {
            if (patterns[j].action != undefined) {
              patterns[j].action(match[0], colorized);
            } else {
              colorized.append($('<span>').addClass(patterns[j].class).text(match[0]));
            }
            i += match[0].length - 1;
            break;
          };
        }
        i++;
      }
      return colorized;
    }
    function colorize(el) {
      var text = el.text();
      var pos = el.caret('pos');
      var colorized = colorize_text(text);
      el.html(colorized.html());
      el.caret('pos', pos);
    }
    function line_numbers(el) {
      var lines = el.text().split('\n').length;
      var container = el.parent().children('.line-numbers');
      container.empty();
      while (lines) {
        lines--;
        container.append('<span>');
      }
    }
    function insert_newline(el) {
      var pos = el.caret('pos');
      var text = el.text();
      var text = text.slice(0, pos) + '\n' + text.slice(pos);
      var colorized = colorize_text(text);
      el.html(colorized.html());
      el.caret('pos', pos+1);
    }
    function insert_tab(el) {
      var pos = el.caret('pos');
      var text = el.text();
      var text = text.slice(0, pos) + '  ' + text.slice(pos);
      var colorized = colorize_text(text);
      el.html(colorized.html());
      el.caret('pos', pos+2);
    }
    return this.each(function() {
      var elem = $(this);
      // Initialize editor
      var template = $(`<div class="clio-ide tomorrow-theme">
        <div class="toolbar-container">
          <div class="toolbar">
            <a href="#" class="run-code">Run</a>
            <a href="#" class="show-ast">AST</a>
            <a href="#" class="show-editor">Editor</a>
            <a href="#" class="show-console">Console</a>
            <select class="theme-select">
              <option value="dracula">Dracula</option>
              <option value="tomorrow-night">Tomorrow Night</option>
              <option value="tomorrow" selected>Tomorrow</option>
              <option value="ayu-light">Ayu Light</option>
            </select>
            <span class="expand"></span>
            <a href="#" class="open-file">Open</a>
            <input type="file" class="file-opener" />
            <a href="#" class="save-file">Download</a>
          </div>
        </div>
        <div class="clio-editor-container">
          <div class="caret"></div>
          <pre class="line-numbers"></pre>
          <pre class="clio-editor" contenteditable="true"></pre>
        </div>
        <div class="console-container">
          <pre class="console"></pre>
        </div>
      </div>`);
      template.find('.clio-editor').text(elem.text());
      elem.replaceWith(template);
      elem = template.find('.clio-editor');
      var ide = elem.parent().parent(); // TODO: fix these!
      var console_div = ide.find('.console');
      var editor_container = ide.find('.clio-editor-container');
      var console_container = ide.find('.console-container');
      var theme = 'tomorrow-theme'
      ide.find('select.theme-select').change(function (e) {
        ide.removeClass(theme);
        theme = `${$(this).val()}-theme`;
        ide.addClass(theme)
      })
      ide.find('a.show-ast').click(function (e) {
        e.preventDefault();
        console_div.empty();
        (function(){
            ide.find('.show-console').click();
            var printfn = function () {
              console_div.append($('<span>').addClass('console-line').text([...arguments].join(' ')));
            };
            var code = elem.text().trimEnd();
            var code = `${code}\n`;
            clio_process_source(code, 'ast', false, printfn);
        })();
      })
      ide.find('a.run-code').click(function (e) {
        e.preventDefault();
        console_div.empty();
        (function(){
            ide.find('.show-console').click();
            var printfn = function () {
              var type = typeof arguments[0];
              var _args = [...arguments].map(function(arg) {
                if (typeof arg == 'string') {
                  return arg;
                }
                return arg.toString();
              });
              console_div.append($('<span>').addClass('console-line').addClass(type).text([..._args].join(' ')));
            };
            var code = elem.text().trimEnd();
            var code = `${code}\n`;
            clio_process_source(code, 'run', true, printfn);
        })();
      })
      console_container.hide();
      ide.find('.show-editor').hide();
      ide.find('.show-console').click(function (e) {
        e.preventDefault();
        editor_container.hide();
        console_container.show();
        ide.find('.show-console').hide();
        ide.find('.show-editor').show();
      });
      ide.find('.show-editor').click(function (e) {
        e.preventDefault();
        editor_container.show();
        console_container.hide();
        ide.find('.show-console').show();
        ide.find('.show-editor').hide();
      });
      ide.find('.open-file').click(function (e) {
        e.preventDefault();
        ide.find('.file-opener').click();
      });
      ide.find('.file-opener').change(function (e) {
        //Set the extension for the file
         var fileExtension = /.*?\.(js|clio)/;
         //Get the file object
         var fileTobeRead = this.files[0];
        //Check of the extension match
         if (fileTobeRead.name.match(fileExtension)) {
             //Initialize the FileReader object to read the 2file
             var fileReader = new FileReader();
             fileReader.onload = function (e) {
                 var result = fileReader.result;
                 var colorized = colorize_text(result);
                 elem.html(colorized.html());
                 elem.caret('pos', 0);
                 line_numbers(elem);
             }
             fileReader.readAsText(fileTobeRead);
         }
         else {
             alert("File type not supported");
         }
      });
      ide.find('.save-file').click(function (e) {
        e.preventDefault();
        var text = elem.text();
        save_file('source.clio', text);
      });
      elem.attr("spellcheck",false);
      colorize(elem);
      line_numbers(elem);
      var history = [{text: elem.text(), pos: 0}];
      var future = [];
      function record_history() {
        var text = elem.text();
        var pos = elem.caret('pos');
        if (text != history[history.length-1]) {
          history.push({text: text, pos: pos});
          if (history.length > 500) {
            history.shift();
          }
        }
      }
      elem.click(function (e) {
        insertCaret(elem)
      })
      elem.keydown(function(e) {
         var code = e.keyCode || e.which;
         if (code == '9') {
           e.preventDefault();
           insert_tab(elem);
           line_numbers(elem);
           insertCaret(elem);
         }
      });
      elem.keyup(function (e) {
        setTimeout(function () {
          if (!(e.ctrlKey || e.shiftKey || (e.which == 16) || (e.which == 17))) {
            colorize(elem);
            line_numbers(elem);
            insertCaret(elem);
          }
        }, 0);
        var char = String.fromCharCode(e.which);
        if ((char == 'z') && (e.ctrlKey)) {
          if (history.length > 0) {
            if (history.length > 1) {
              var before = history.pop();
              record_history();
              future.push(history.pop());
            } else {
              var before = history[0];
            }
            var colorized = colorize_text(before.text);
            elem.html(colorized.html());
            setTimeout(function () {
              elem.caret('pos', before.pos);
            }, 0);
            return;
          }
        } else if ((char == 'y') && (e.ctrlKey)) {
          if (future.length > 0) {
            var pos = elem.caret('pos');
            var after = future.pop();
            history.push(after);
            var colorized = colorize_text(after.text);
            elem.html(colorized.html());
            setTimeout(function () {
              elem.caret('pos', after.pos);
            }, 0);
            return;
          }
        }
        if (e.ctrlKey || e.shiftKey) {
          return;
        }
        if (window.getSelection && e.which == 8) { // backspace
            $('.caret').remove()
            // fix backspace bug in FF
            // https://bugzilla.mozilla.org/show_bug.cgi?id=685445
            var selection = window.getSelection();
            if (!selection.isCollapsed || !selection.rangeCount) {
                return;
            }

            var curRange = selection.getRangeAt(selection.rangeCount - 1);
            if (curRange.commonAncestorContainer.nodeType == 3 && curRange.startOffset > 0) {
                // we are in child selection. The characters of the text node is being deleted
                return;
            }

            var range = document.createRange();
            if (selection.anchorNode != this) {
                // selection is in character mode. expand it to the whole editable field
                range.selectNodeContents(this);
                range.setEndBefore(selection.anchorNode);
            } else if (selection.anchorOffset > 0) {
                range.setEnd(this, selection.anchorOffset);
            } else {
                // reached the beginning of editable field
                return;
            }
            range.setStart(this, range.endOffset - 1);


            var previousNode = range.cloneContents().lastChild;
            if (previousNode && previousNode.contentEditable == 'false') {
                // this is some rich content, e.g. smile. We should help the user to delete it
                range.deleteContents();
                event.preventDefault();
            }
        }
        if ([' ', '\n'].includes(char)) {
          record_history();
          /* macros!
          var pos = elem.caret('pos');
          var text = elem.text();
          var word = text.slice(pos-2, pos);

          if (word == '->') {
            text = text.slice(0, pos-2) + '→' + text.slice(pos);
            var colorized = colorize_text(text);
            elem.html(colorized.html());
            elem.caret('pos', pos-1);
          } else if (word == '=>') {
            text = text.slice(0, pos-2) + '⇒' + text.slice(pos);
            var colorized = colorize_text(text);
            elem.html(colorized.html());
            elem.caret('pos', pos-1);
          } else if (word == '>=') {
            text = text.slice(0, pos-2) + '≥' + text.slice(pos);
            var colorized = colorize_text(text);
            elem.html(colorized.html());
            elem.caret('pos', pos-1);
          } else if (word == '=<') {
            text = text.slice(0, pos-2) + '≤' + text.slice(pos);
            var colorized = colorize_text(text);
            elem.html(colorized.html());
            elem.caret('pos', pos-1);
          }*/

        } else if (e.which == 13) {
          e.preventDefault();
          insert_newline(elem);
        }
        elem.get(0).focus();
      })
    });
  },
});
