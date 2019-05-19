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
    'notebook/js/tooltip',
    'notebook/js/pager',
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
    tooltip,
    pager,
    CodeMirror,
    cmpython,
    cmip
    ) {
    "use strict";
    
    var Cell = cell.Cell;
    var CodeCell = codecell.CodeCell;
    var TextCell = textcell.TextCell;
    var Notebook = notebook.Notebook;
    var Tooltip = tooltip.Tooltip;
    //var Pager = pager.Pager;

    // var orig_show = Tooltip.prototype._show;
    Tooltip.prototype._show = function (reply) {

        //orig_show.call(this, reply);

        this._reply = reply;
        var content = reply.content;
        //this.events.trigger('collapse_pager.Pager', content);

        if (!content.found) {
            // object not found, nothing to show
            return;
        }

        this.name = content.name;
        this.cancel_stick();

        Jupyter.pager.clear();
        Jupyter.pager.expanded = true;
        
        var payload = content;

        if (payload.data['text/html'] && payload.data['text/html'] !== "") {
                Jupyter.pager.append(payload.data['text/html']);
        } else if (payload.data['text/plain'] && payload.data['text/plain'] !== "") {
                Jupyter.pager.append_text(payload.data['text/plain']);
        }

        Jupyter.pager.pager_element.height('initial');
        Jupyter.pager.pager_element.show("fast", function () {
                Jupyter.pager.pager_element.height(Jupyter.pager.pager_element.height());
                Jupyter.pager._resize();
                Jupyter.pager.pager_element.css('position', 'relative');
                //window.requestAnimationFrame(function() { /* Wait one frame */                    
                    Jupyter.pager.pager_element.css('position', '');
                //});
            }
        );

        //this.showInPager(this._old_cell);
        //this.events.trigger('open_with_text.Pager', this._reply.content);

    }

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
        return ''; // '[' + ns + ']';
    };

    CodeCell.input_prompt_function = agda_input_prompt;

    var upgrade_cell = function(cell, index) {

        console.log("[agda-extension] reloading cell");

        var cell_index = Jupyter.notebook.find_cell_index(cell);
        var new_cell = Jupyter.notebook.insert_cell_above(cell.cell_type, index);
        new_cell.unrender();
        new_cell.fromJSON(JSON.stringify(cell.toJSON()));
        /*
        new_cell.set_text(cell.get_text());
        new_cell.output_area = JSON.parse(JSON.stringify(cell.output_area));
        new_cell.metadata = JSON.parse(JSON.stringify(cell.metadata));
        */
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

        /* output examples

        *All Errors*: /Users/lorenzo/Dropbox/Workspace/teaching/Teaching/2018-2019/summer semester/LDI (logika dla informatyków)/lab/agda/raw_material/test.agda:2,1-7
The following names are declared but not accompanied by a
definition: error1

        *Error*: /Users/lorenzo/Dropbox/Workspace/teaching/Teaching/2018-2019/summer semester/LDI (logika dla informatyków)/lab/agda/raw_material/code/coinduction.agda:53,27-28
        Data.Product.Σ P (λ x → Q) !=< P of type Set
        when checking that the expression A has type NFA Σ (P × Q)

        *Error*: /Users/lorenzo/Dropbox/Workspace/teaching/Teaching/2018-2019/summer semester/LDI (logika dla informatyków)/lab/agda/raw_material/test.agda:5,8-8
        /Users/lorenzo/Dropbox/Workspace/teaching/Teaching/2018-2019/summer semester/LDI (logika dla informatyków)/lab/agda/raw_material/test.agda:5,8: Parse error
        <EOF><ERROR>
        ...

        *All Goals, Errors*: ?0 : _58
        Sort _57  [ at /Users/lorenzo/Dropbox/Workspace/teaching/Teaching/2018-2019/summer semester/LDI (logika dla informatyków)/lab/agda/raw_material/code/coinduction.agda:53,27-30 ]
        _58 : _57  [ at /Users/lorenzo/Dropbox/Workspace/teaching/Teaching/2018-2019/summer semester/LDI (logika dla informatyków)/lab/agda/raw_material/code/coinduction.agda:53,27-30 ]
        _61 : NFA Σ (P × Q)  [ at /Users/lorenzo/Dropbox/Workspace/teaching/Teaching/2018-2019/summer semester/LDI (logika dla informatyków)/lab/agda/raw_material/code/coinduction.agda:53,27-30 ]

        ———— Errors ————————————————————————————————————————————————
        Failed to solve the following constraints:
        _60 := (_ : _58) [?] :? NFA Σ (P × Q)

        */

        if (output == "OK") {
            make_cell_green(cell);
            return ""; // no output on successful compilation
        }
        else if (output.match(/^\*Error\*|\*All Errors\*|\*All Goals, Errors\*/)) { // if there is an error

            if (cell.cell_type == "markdown") {
                //console.log("[agda-extension] process_new_output, unrendering cell");
                // unrender the cell if it is a markdown cell
                cell.unrender();
            }

            var fname = null;
            var re = /\/.*\/(?![\/])(.*\.agda)\:(\d+),\d+-(\d+)(,\d+)?/g;
            var matches = output.matchAll(re);

            for (const match of matches) {

                //console.log("[agda-extension] found a match \"" + match + "\"");

                fname = match[1];
                var from = match[2];
                var to = from;

                if (match[4] !== undefined) {
                    to = match[3];
                }

                highlight_error_in_cell_and_store_in_metadata(cell, from, to);

            }

            var re = /(\/.*\.agda)/;
            var matches = re.exec(output);

            if(matches !== null) {

                var long_fname = matches[0];

                // shorten the filename for readability
                //console.log("[agda-extension] replacing full filename \"" + long_fname + "\", with: \"" + fname + "\"");

                var re = new RegExp(escape(long_fname), "g");
                output = output.replace(re, fname);

            }
        }

        return output;

    }

    var finished_execute_handler = function(evt, data) {

        // retrieve the contents of the output area
        var cell = data.cell;
        var outputs = cell.output_area.toJSON();

        if(outputs !== undefined && outputs[0] !== undefined) {

            var output = outputs[0].text;
            var new_output = process_new_output(cell, output);

            //console.log("[agda-extension] finished_execute_handler, new_output: " + new_output);

            outputs[0].text = new_output;
            cell.clear_output(false, true);
            cell.output_area.fromJSON(outputs, data.metadata);
        }
    };

    var remove_error_highlight = function(cell) {

        var cm = cell.code_mirror;
        //var len = cm.lineCount();

        var remove_background = function (lineHandle) {
            // console.log("[agda-extension] removing highlighting from line " + lineHandle);
            cm.removeLineClass(lineHandle, "background", "compile-error");
        };

        cm.eachLine(remove_background);
        cell.metadata.codehighlighter = [];

    };

    var execute_handler = function(evt, data) {

        // retrieve the contents of the output area
        var cell = data.cell;
        remove_error_highlight(cell);

    };

    var change_handler = function (evt, data) {

        var cell = data.cell;
        var change = data.change;

        if (change) {

            unmake_cell_green(cell);
            remove_error_highlight(cell);

        }

    };

    var agda_init = function() {
        // read configuration, then call toc
        Jupyter.notebook.config.loaded.then(function () {

            upgrade_cells();
            highlight_from_metadata();

            //events.on("rendered.MarkdownCell", function(evt, data) {
            //    var cell = $(data.cell);;
            //    render_cell(cell);
            //});

            var pager = Jupyter.pager;
            //pager.pager_button_area.remove();
            //pager.pager_button_area = $('#pager-button-area');

            // hide the previous buttons
            var buttons = document.getElementsByClassName('ui-button');
            for (var i = 0; i < buttons.length; i++) {
                //y[i].style.backgroundColor = "red";
                buttons[i].style.visibility = 'hidden';
            }
            
            // add a single close button
            pager.pager_button_area.append(
                $('<a>').attr('role', "button")
                    .attr('title',i18n.msg._("Close the pager"))
                    .addClass('ui-button')
                    .click(function(){pager.collapse();})
                    .append(
                        $('<span>').addClass("ui-icon ui-icon-close")
                    )
            );

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

    var highlight_error_in_cell_and_store_in_metadata = function (cell, from, to) {

        //console.log("[agda-extension] highlight_error_in_cell, from: " + from + ", to: " + to);

        if (!cell.metadata.codehighlighter)
            cell.metadata.codehighlighter = [];

        // save the highlighting information in the metadata
        cell.metadata.codehighlighter.push([from, to]);

        highlight_error_in_cell(cell, from, to);
    };

    var highlight_error_in_cell = function (cell, from, to) {

        var cm = cell.code_mirror;

        for (var lineno = from; lineno <= to; lineno++) {
            cm.addLineClass(lineno - 1, "background", "compile-error");
        }
    }

    var highlight_from_metadata = function() {
        Jupyter.notebook.get_cells().forEach(function(cell) {
            if (cell.metadata.codehighlighter) {
                cell.metadata.codehighlighter.forEach(function(range) {
                    highlight_error_in_cell(cell, range[0], range[1]);
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