define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'base/js/i18n',
    'base/js/keyboard',
    'services/config',
    'notebook/js/mathjaxutils',
    'base/js/events',
    'notebook/js/cell',
    'notebook/js/textcell',
    'notebook/js/codecell',
    'notebook/js/outputarea',
    'notebook/js/completer',
    'notebook/js/celltoolbar',
    'notebook/js/notebook',
    'codemirror/lib/codemirror',
    'codemirror/mode/python/python',
    'notebook/js/codemirror-ipython'
], function(
    requirejs,
    $,
    Jupyter,
    utils,
    i18n,
    keyboard,
    configmod,
    mathjaxutils,
    events,
    cell,
    textcell,
    codecell,
    outputarea,
    completer,
    celltoolbar,
    notebook,
    CodeMirror,
    cmpython,
    cmip
    ) {
    "use strict";
    
    var Cell = cell.Cell;
    var CodeCell = codecell.CodeCell;
    var TextCell = textcell.TextCell;
    var Notebook = notebook.Notebook;

    var escape = function(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

    var agda_input_prompt = function (prompt_value, lines_number) {
        var ns;
        if (prompt_value === undefined || prompt_value === null) {
            ns = "&nbsp;";
        } else {
            ns = encodeURIComponent(prompt_value);
        }
        return '[' + ns + ']';
    };

    CodeCell.input_prompt_function = agda_input_prompt;

    /*
    MarkdownCell.prototype.execute = function (stop_on_error) {

        var text = this.get_text();
        //console.log("execute, current text: " + text);

        // extract blocks of code between executable code chunks markers "````"
        var blocks = text.split('````');

        // we are interested in odd blocks        
        var code = "";
        for (var i = 0; i < blocks.length; i++) {

            // even blocks contain markup code and are replaced by blank lines;
            // this helps the kernel giving error messages with the correct line numbers
            if (i % 2 == 0) { 
                var lines = blocks[i].split('\n');
                for (var j = 0; j < lines.length - 1; j++) {
                    code += "\n";
                }
            }
            else // odd blocks contain executable code
                code += blocks[i];
        }

        //console.log("Extracted executable code chunks: \n" + code);

        this.rendered = false;
        MarkdownCell.prototype.set_text.call(this, code);
        CodeCell.prototype.execute.call(this, stop_on_error);
        this.rendered = false;
        MarkdownCell.prototype.set_text.call(this, text);
        MarkdownCell.prototype.render.call(this);
        this.auto_highlight();

    };

    MarkdownCell.prototype.render = function () {

        var text = this.get_text();
        var blocks = text.split('````');
        var code = "";

        //console.log("Blocks: " + blocks);

        if (blocks.length > 0 && this.kernel) {

            var kernel = this.kernel.name;
            //console.log("[literate-markdown] current kernel: " + kernel);
    
            for (var i = 0; i < blocks.length; i++) {
                code += blocks[i];
                i++;
                if (i < blocks.length) {
                    code += '```' + kernel; // instruct codemirror to render the code with the current kernel name
                    code += blocks[i];
                    code += '```';
                }
            }
        }
        else
            code = text;

        this.unrender();
        this.code_mirror.setValue(code);
        var cont = original_render.apply(this);
        this.code_mirror.setValue(text);
        //this.rendered = true;
        return cont;
        
    };
    */

    /*
    MarkdownCell.prototype.fromJSON = function (data) {

        console.log("[literate-markdown] called fromJSON");

        Cell.prototype.fromJSON.apply(this, arguments);
        if (data.cell_type === 'markdown') {

            if (data.attachments !== undefined) {
                this.attachments = data.attachments;
            }

            if (data.source !== undefined) {
                this.set_text(data.source);
                // make this value the starting point, so that we can only undo
                // to this state, instead of a blank cell
                this.code_mirror.clearHistory();
                this.auto_highlight();
                // TODO: This HTML needs to be treated as potentially dangerous
                // user input and should be handled before set_rendered.
                this.set_rendered(data.rendered || '');
                render_cell(this);
            }

            if (data.execution_count !== undefined) {
                // this.set_input_prompt(data.execution_count);
            }

            this.output_area.trusted = data.metadata.trusted || false;

            if (data.outputs !== undefined) {
                // this.output_area.fromJSON(data.outputs, data.metadata);
            }
        }
    };

    MarkdownCell.prototype.toJSON = function () {
        var data = original_toJSON.apply(this);

        return data;
    };

    */

    var upgrade_cell = function(cell, index) {

        console.log("[agda-extension] reloading cell");

        var new_cell = Jupyter.notebook.insert_cell_above(cell.cell_type, index);
        new_cell.unrender();
        new_cell.set_text(cell.get_text());
        new_cell.metadata = JSON.parse(JSON.stringify(cell.metadata));
        var cell_index = Jupyter.notebook.find_cell_index(cell);
        Jupyter.notebook.delete_cell(cell_index);
        render_cell(new_cell);

    }

    var upgrade_cells = function () {
        var ncells = Jupyter.notebook.ncells();
        var cells = Jupyter.notebook.get_cells();

        for (var i = 0; i < ncells; i++) {
            var cell = cells[i];
            upgrade_cell(cell, i);
        }

    };

    var render_cell = function(cell) {
        //var element = cell.element.find('div.text_cell_render');
        //var text = execute_python(cell, element[0].innerHTML);
        //if (text !== undefined) {
        //    element[0].innerHTML = text;
        //    MathJax.Hub.Queue(["Typeset",MathJax.Hub,element[0]]);
        //}

        console.log("[literate-markdown] rendering cell");
        cell.rendered = false;
        cell.render();
    };

    var make_cell_green = function(cell) {

          // make lines green
          var cm = cell.code_mirror;
          var mark_green = function (lineHandle) {
              cm.addLineClass(lineHandle, "background", "compile-ok");
          };

          cm.eachLine(mark_green);

    }

    var unmake_cell_green = function(cell) {

        var cm = cell.code_mirror;
        var unmark_green = function (lineHandle) {
            cm.removeLineClass(lineHandle, "background", "compile-ok");
        };

        cm.eachLine(unmark_green);
        
    }

    var process_new_output = function (cell, output) {

        if (output == "OK") {
            make_cell_green(cell);
            return ""; // no output on successful compilation
        }
        else if (output.match(/^(\*Error\*|\*All Goals, Errors\*)/)) { // if there is an error

//            if (cell.cell_type == "markdown") {
                console.log("[agda-extension] process_new_output, unrendering cell");
                // unrender the cell if it is a markdown cell
                cell.unrender();
  //          }

            /*            
                *Error*: filename: range
                range: 57,18-18
                range: 56,5-57,17
            */

            console.log("[agda-extension] process_new_output, output: " + output);
            var lines = output.split('\n');
            
            var full_filename = null, filename = null, from = null, to = null;

            var re_filename = /^(\*Error\*|\*All Goals, Errors\*)\: (.*)\:.*$/g;
            var parse_filename = re_filename.exec(lines[0]);

            if(parse_filename !== null && parse_filename.length > 2) {

                full_filename = parse_filename[2];

                var re_last = /^.*\/(.*)$/g;
                parse_filename = re_last.exec(full_filename);

                if(parse_filename !== null && parse_filename.length == 2) {

                    filename = parse_filename[1];

                }

            }

            // line,col1-col2
            var re1 = /^(\*Error\*|\*All Goals, Errors\*).*\:.*\:(\d+),(\d+)-(\d+)$/g;

            // line1,col1-line2,col2
            var re2 = /^(\*Error\*|\*All Goals, Errors\*).*\:.*\:(\d+),(\d+)-(\d+),(\d+)$/g;

            var parse1 = re1.exec(lines[0]);
            var parse2 = re2.exec(lines[0]);

            if (parse2 !== null) {

                console.log("[agda-extension] process_new_output, len2: " + parse2.length);

                if(parse2.length > 5) {

                    from = parse2[2];
                    to = parse2[4];

                }

            }
            else if (parse1 !== null) {

                console.log("[agda-extension] process_new_output, len1: " + parse1.length);
                
                if (parse1.length > 2) {

                    from = parse1[2];
                    to = from;
                }

            }

            console.log("[agda-extension] process_new_output, from: " + from + ", to: " + to);

            if(from !== null && to !== null) {

                highlight_error_in_cell(cell, from, to);

            }

            if(full_filename !== null && filename !== null) {

                // shorten the filename for readability
                console.log("[agda-extension] replacing full filename \"" + full_filename + "\", with: \"" + filename + "\"");

                var re = new RegExp(escape(full_filename), "gi");
                output = output.replace(re, filename);

            }

        }

        return output;

    }

    var finished_execute_handler = function(evt, data) {

        // retrieve the contents of the output area
        var cell = data.cell;
        var outputs = cell.output_area.toJSON();
        var output = outputs[0].text;

        var new_output = process_new_output(cell, output);

        console.log("[agda-extension] new_output: " + new_output);

        outputs[0].text = new_output;
        cell.clear_output(false, true);
        cell.output_area.fromJSON(outputs, data.metadata);

    };

    var execute_handler = function(evt, data) {

        // retrieve the contents of the output area
        var cell = data.cell;
        var cm = cell.code_mirror;
        //var len = cm.lineCount();

        var remove_background = function (lineHandle) {
            // console.log("[agda-extension] removing highlighting from line " + lineHandle);
            cm.removeLineClass(lineHandle, "background", "compile-error");
        };

        cm.eachLine(remove_background);

    };

    var change_handler = function (evt, data) {



        var cell = data.cell;
        var change = data.change;

        if (change) {

            unmake_cell_green(cell);

        }

    };

    var agda_init = function() {
        // read configuration, then call toc
        Jupyter.notebook.config.loaded.then(function () {

            upgrade_cells();
 
            //events.on("rendered.MarkdownCell", function(evt, data) {
            //    var cell = $(data.cell);;
            //    render_cell(cell);
            //});

            events.on("finished_execute.CodeCell", finished_execute_handler);
            events.on("finished_execute.MarkdownCell", finished_execute_handler);
            events.on("change.Cell", change_handler);
            events.on('execute.CodeCell', execute_handler);
            events.on('execute.MarkdownCell', execute_handler);
    

        });

        // event: on cell selection, highlight the corresponding item
        //events.on('select.Cell', highlight_toc_item);
            // event: if kernel_ready (kernel change/restart): add/remove a menu item
        events.on("kernel_ready.Kernel", function() {

        })

    }

    var load_css = function() {
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = requirejs.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    var highlight_error_in_cell = function (cell, from, to) {

        console.log("[agda-extension] highlight_error_in_cell, from: " + from + ", to: " + to);

        if (!cell.metadata.codehighlighter)
            cell.metadata.codehighlighter = [];

        // save the highlighting information in the metadata
        cell.metadata.codehighlighter.push([from, to]);

        var cm = cell.code_mirror;

        for (var lineno = from; lineno <= to; lineno++) {
            console.log("[agda-extension] highlight_error_in_cell, line: " + lineno);
            cm.addLineClass(lineno - 1, "background", "compile-error");
        }
    }

    var highlight_from_metadata = function() {
        Jupyter.notebook.get_cells().forEach(function(cell) {
            if (cell.metadata.codehighlighter) {
                cell.metadata.codehighlighter.forEach(function(range) {
                    highlight_code_in_cell(cell, range[0], range[1]);
                });
            }
        });
    }

    var load_ipython_extension = function() {
        //load_css();
        //events.on("rendered.MarkdownCell", function (event, data) {
        //    render_cell(data.cell);
        // });
        // events.on("trust_changed.Notebook", set_trusted_indicator);

        // $('#save_widget').append('<i id="notebook-trusted-indicator" class="fa fa-question notebook-trusted" />');
        // set_trusted_indicator();

        /* Show values stored in metadata on reload */

        var style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = '.compile-error { background: rgb(255, 150, 150); } .compile-ok { background: rgb(240, 255, 245); }';
        document.getElementsByTagName('head')[0].appendChild(style);

        events.on("kernel_ready.Kernel", function () {
            if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
                console.log("[agda-extension] Notebook fully loaded --  agda-extension initialized");
                agda_init();
            } else {
                events.on("notebook_loaded.Notebook", function () {
                console.log("[agda-extension] agda-extension initialized (via notebook_loaded)");
                agda_init();
                })
            }
        })       
    };

    return {
        load_ipython_extension : load_ipython_extension
    };

});
