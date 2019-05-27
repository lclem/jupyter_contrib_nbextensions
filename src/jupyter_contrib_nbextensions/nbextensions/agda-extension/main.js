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
    'services/kernels/kernel',
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
    kernel,
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

    var mod_name = 'agda-extension';
    var log_prefix = '[' + mod_name + ']';

    var Kernel = kernel.Kernel;
    var Cell = cell.Cell;
    var CodeCell = codecell.CodeCell;
    var TextCell = textcell.TextCell;
    var MarkdownCell = textcell.MarkdownCell;
    var Notebook = notebook.Notebook;
    var Tooltip = tooltip.Tooltip;
    var OutputArea = outputarea.OutputArea;
    //var Pager = pager.Pager;

    var old_handle_input_request = Kernel.prototype._handle_input_request;
    Kernel.prototype._handle_input_request = function(request) {
        //console.log("_handle_input_request request: ", request);
        old_handle_input_request.call(this, request);
    };

    var old_handle_input_message = Kernel.prototype._handle_input_message;
    Kernel.prototype._handle_input_message = function(msg) {
        //console.log("_handle_input_message msg: ", msg);
        old_handle_input_message.call(this, msg);
    };

    var old_handle_output_message = Kernel.prototype._handle_output_message;
    Kernel.prototype._handle_output_message = function(msg) {
        //console.log("_handle_output_message msg: ", msg);
        old_handle_output_message.call(this, msg);
    };

    var old_handle_status_message = Kernel.prototype._handle_status_message;
    Kernel.prototype._handle_status_message = function(msg) {
        //console.log("_handle_status_message msg: ", msg);
        old_handle_status_message.call(this, msg);
    };

    var old_handle_shell_reply = Kernel.prototype._handle_shell_reply;
    Kernel.prototype._handle_shell_reply = function(reply) {
        //console.log("_handle_shell_reply reply: ", reply);
        old_handle_shell_reply.call(this, reply);
    };

    var original_expand = OutputArea.prototype.expand;
    OutputArea.prototype.expand = function() {
        if (!this.do_not_expand)
            original_expand.call(this);
    };

    // var orig_show = Tooltip.prototype._show;
    Tooltip.prototype._show = function(reply) {

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
        Jupyter.pager.pager_element.show("fast", function() {
            Jupyter.pager.pager_element.height(Jupyter.pager.pager_element.height());
            Jupyter.pager._resize();
            Jupyter.pager.pager_element.css('position', 'relative');
            //window.requestAnimationFrame(function() { /* Wait one frame */                    
            Jupyter.pager.pager_element.css('position', '');
            //});
        });

        //this.showInPager(this._old_cell);
        //this.events.trigger('open_with_text.Pager', this._reply.content);

    }

    var escape = function(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

    var agda_input_prompt = function(prompt_value, lines_number) {
        var ns;
        if (prompt_value === undefined || prompt_value === null) {
            ns = "&nbsp;";
        } else {
            ns = encodeURIComponent(prompt_value);
        }
        return ''; // '[' + ns + ']';
    };

    CodeCell.input_prompt_function = agda_input_prompt;

    /*
    var make_cell_yellow = function(cell) {

        var cm = cell.code_mirror;
        var cm_lines = cm.getWrapperElement().getElementsByClassName('CodeMirror-lines');
        cm_lines[0].classList.add("compile-holes");

    }

    var unmake_cell_yellow = function(cell) {

        var cm = cell.code_mirror;
        var cm_lines = cm.getWrapperElement().getElementsByClassName('CodeMirror-lines');
        cm_lines[0].classList.remove("compile-holes");

    }
    */

    var make_cell_green = function(cell) {

        // make lines green
        var cm = cell.code_mirror;

        /*
        var mark_green = function(lineHandle) {
            cm.addLineClass(lineHandle, "background", "compile-ok");
        };

        cm.eachLine(mark_green);
        */

        // unfortunately this selects the next cell instead of the current one
        //var cm_lines = document.activeElement.getElementsByClassName('CodeMirror-lines'); 
        var cm_lines = cm.getWrapperElement().getElementsByClassName('CodeMirror-lines');
        cm_lines[0].classList.add("compile-ok");

        if (cell.cell_type == "code") {
            var input_area = cell.element.find('div.input_area')[0]; //.getElementsByClassName('input_area')[0];
            $(input_area).addClass("compile-ok-border");
            $(input_area).addClass("compile-ok");

            //var cm = cell.element.find('CodeMirror')[0];
            //$(cm).addClass("compile-ok-border");
        }
    }

    var unmake_cell_green = function(cell) {

        var cm = cell.code_mirror;

        /*
        var unmark_green = function(lineHandle) {
            cm.removeLineClass(lineHandle, "background", "compile-ok");
        };

        cm.eachLine(unmark_green);
        */

        var cm_lines = cm.getWrapperElement().getElementsByClassName('CodeMirror-lines');
        cm_lines[0].classList.remove("compile-ok");

        if (cell.cell_type == "code") {
            var input_area = cell.element.find('div.input_area')[0]; //.getElementsByClassName('input_area')[0];
            $(input_area).removeClass("compile-ok-border");
            $(input_area).removeClass("compile-ok");

            //var cm = cell.element.find('CodeMirror')[0];
            //$(cm).removeClass("compile-ok-border");
        }
    }

    var process_new_output = function(cell, output) {

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

        //console.log("[agda-extension] output: \"" + output + "\"");

        var new_output = String(output);

        //console.log("[agda-extension] process output, cell filename: " + cell.metadata.fileName);

        if (output == "OK") {
            //unmake_cell_yellow(cell);
            make_cell_green(cell);
            return ""; // no output on successful compilation
        }

        //if ( /*output.match(/^\?0/) && */ cell.metadata.holes) { // (^(\*All Goals\*/|\?0)/))) {
        //console.log("[agda-extension] make cell yellow");
        //make_cell_yellow(cell); // there are open goals, make cell yellow

        // add markes for lines with holes

        //return output;
        //}

        if (output.match(/^\*Error\*|\*All Errors\*|\*All Warnings\*|\*All Goals, Errors\*|\*All Errors, Warnings\*|\*All Goals, Errors, Warnings\*|\*All Goals, Warnings\*/)) { // if there is an error

            if (cell.cell_type == "markdown") {
                //console.log("[agda-extension] process_new_output, unrendering cell");
                // unrender the cell if it is a markdown cell
                cell.unrender();
            }

            //console.log("[agda-extension] handling error");

            //var re = /.*(\/.*((?![\/]).*\.agda))\:(\d+),\d+-(\d+)(,\d+)?/g;
            var re = /(\/.*\/((?![\/]).*\.agda))\:(\d+),\d+-(\d+)(,\d+)?/g;
            var matches = output.matchAll(re);

            for (const match of matches) {

                //console.log("[agda-extension] found a match \"" + match + "\"");
                //console.log("[agda-extension] 0: \"" + match[0] + "\", ", "1: \"" + match[1] + "\", ", "2: \"" + match[2] + "\"" + "\", ", "3: \"" + match[3] + "\"");

                var long_fname = match[1];
                var fname = match[2];
                var from = match[3];
                var to = from;

                if (match[5] !== undefined) {
                    to = match[4];
                }

                // check whether the error is in this cell
                if (long_fname === cell.metadata.fileName)
                    highlight_error_in_cell_and_store_in_metadata(cell, from, to);

                // shorten the filename for readability
                //console.log("[agda-extension] replacing full filename \"" + long_fname + "\", with: \"" + fname + "\"");

                var re1 = new RegExp(escape(long_fname), "g");
                new_output = new_output.replace(re1, fname);

            }

        }

        return new_output;

    }

    var finished_execute_handler = function(evt, data) {

        // retrieve the contents of the output area
        var cell = data.cell;
        var outputs = cell.output_area.toJSON();
        cell.output_area.do_not_expand = false;

        if (outputs !== undefined && outputs[0] !== undefined) {

            var output = outputs[0].text;
            var new_output = process_new_output(cell, output);

            console.log("[agda-extension] finished_execute_handler, original output: " + output + ", new output: " + new_output);

            outputs[0].text = new_output;
            cell.clear_output(false, true);
            cell.output_area.fromJSON(outputs, data.metadata);
        }
    };

    var remove_all_highlights = function(cell) {

        var cm = cell.code_mirror;
        cm.eachLine(function(lineHandle) {
            cm.removeLineClass(lineHandle, "background", "compile-error");
            cm.removeLineClass(lineHandle, "background", "compile-hole");
        });
        cell.metadata.codehighlighter = [];
        cell.metadata.code_hole_highlighter = [];
    };

    var execute_handler = function(evt, data) {

        console.log("[agda-extension] execute_handler");

        // retrieve the contents of the output area
        var cell = data.cell;
        cell.output_area.collapse();
        cell.output_area.do_not_expand = true;
        remove_all_highlights(cell);

    };

    var change_handler = function(evt, data) {

        console.log("[agda-extension] change_handler");

        var cell = data.cell;
        var change = data.change;

        if (change) {

            unmake_cell_green(cell);
            //unmake_cell_yellow(cell);
            remove_all_highlights(cell);

        }

    };

    var shell_reply_handler = function(evt, data) {

        //console.log("shell_reply_handler evt:" + (evt) + ", data: " + (data));
        var kernel = data.kernel; //TODO: check that the kernel is Agda
        var reply = data.reply
        var content = reply.content;

        //console.log("shell_reply_handler reply.msg_id: " + reply.msg_id)
        //console.log("shell_reply_handler reply.parent_header.msg_id: " + reply.parent_header.msg_id)
        //console.log("shell_reply_handler CodeCell.msg_cells: " + CodeCell.msg_cells)

        //var index = IPython.notebook.get_selected_index();
        var cell = CodeCell.msg_cells[reply.parent_header.msg_id];

        // the current cell is the one before the selected one (not always!!)
        //var cell = IPython.notebook.get_cell(index - 1); 

        console.log("shell_reply_handler cell: " + cell)

        if (content) {

            //console.log("shell_reply_handler content:" + content);
            var user_expressions = content.user_expressions;

            if (user_expressions) {

                //console.log("shell_reply_handler user_expressions:" + user_expressions);
                var fileName = user_expressions["fileName"];

                if (fileName) {

                    //console.log("shell_reply_handler fileName:" + fileName);
                    cell.metadata.fileName = fileName; // save the module file name in the cell metadata

                }

                var holes = user_expressions["holes"];

                if (holes) {

                    console.log("shell_reply_handler holes: " + holes);
                    cell.metadata.holes = holes;

                    for (const hole of cell.metadata.holes) {

                        console.log("process_new_output hole: " + hole);
                        highlight_hole_in_cell_and_store_in_metadata(cell, hole);

                    }


                }

            }

        }

    }

    var agda_init = function() {
        Jupyter.notebook.config.loaded.then(function() {

            console.log("[agda-extension] init");

            //var md = IPython.notebook.metadata
            //md.css = md.css || [''];
            //add_css_list(IPython.toolbar.element,{'duck':null,'dark':{cm:'monokai'},'xkcd':null,'foo':null}, md);

            highlight_from_metadata();

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
                .attr('title', i18n.msg._("Close the pager"))
                .addClass('ui-button')
                .click(function() { pager.collapse(); })
                .append(
                    $('<span>').addClass("ui-icon ui-icon-close")
                )
            );

            events.on("finished_execute.CodeCell", finished_execute_handler);
            events.on("finished_execute.MarkdownCell", finished_execute_handler);
            events.on("change.Cell", change_handler);
            events.on('execute.CodeCell', execute_handler);
            events.on('execute.MarkdownCell', execute_handler);
            events.on("rendered.MarkdownCell", rendered_handler);
            events.on('shell_reply.Kernel', shell_reply_handler);

        });

    }

    var rendered_handler = function(evt, data) {

        // add the class "language-agda" to all pre elements of this cell that contain an element "code.language-agda"
        console.log("[agda-extension] rendered_handler");
        var cell = data.cell;
        cell.element.find('div.text_cell_render pre').each(function(index, value) {
            console.log($(this));
            $(this).has("code.language-agda").addClass("language-agda");
        });
    };


    var load_css = function() {
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = requirejs.toUrl("./style.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    var highlight_error_in_cell_and_store_in_metadata = function(cell, from, to) {

        //console.log("[agda-extension] highlight_error_in_cell, from: " + from + ", to: " + to);

        if (!cell.metadata.codehighlighter)
            cell.metadata.codehighlighter = [];

        // save the highlighting information in the metadata
        cell.metadata.codehighlighter.push([from, to]);

        highlight_error_in_cell(cell, from, to);
    };

    var highlight_error_in_cell = function(cell, from, to) {

        var cm = cell.code_mirror;

        for (var lineno = from; lineno <= to; lineno++) {
            cm.addLineClass(lineno - 1, "background", "compile-error");
        }
    }

    var highlight_hole_in_cell_and_store_in_metadata = function(cell, lineno) {

        if (!cell.metadata.code_hole_highlighter)
            cell.metadata.code_hole_highlighter = [];

        // save the highlighting information in the metadata
        cell.metadata.code_hole_highlighter.push(lineno);
        highlight_hole_in_cell(cell, lineno);
    };

    var highlight_hole_in_cell = function(cell, where) {

        var cm = cell.code_mirror;
        cm.addLineClass(where, "background", "compile-hole");

    }

    var highlight_from_metadata = function() {
        Jupyter.notebook.get_cells().forEach(function(cell) {
            if (cell.metadata.codehighlighter) {
                cell.metadata.codehighlighter.forEach(function(range) {
                    highlight_error_in_cell(cell, range[0], range[1]);
                });
            }

            if (cell.metadata.code_hole_highlighter) {
                cell.metadata.code_hole_highlighter.forEach(function(lineno) {
                    highlight_hole_in_cell(cell, lineno);
                });
            }
        });
    }

    var load_ipython_extension = function() {
        load_css();

        Jupyter.notebook.config.loaded.then(function() {
            if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
                console.log("[agda-extension] Notebook fully loaded -- agda-extension initialized");
                agda_init();
            } else {
                events.on("notebook_loaded.Notebook", function() {
                    console.log("[agda-extension] agda-extension initialized (via notebook_loaded)");
                    agda_init();
                })
            }
        }).catch(function(reason) {
            console.error(log_prefix, 'unhandled error:', reason);
        });
    };

    return {
        load_ipython_extension: load_ipython_extension
    };

});