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
    var Notebook = notebook.Notebook;
    var Tooltip = tooltip.Tooltip;
    var OutputArea = outputarea.OutputArea;
    var Notebook = notebook.Notebook;

    var original_MarkdownCell = textcell.MarkdownCell;
    var original_prototype = original_MarkdownCell.prototype;
    var original_render = original_prototype.render;
    var original_toJSON = original_prototype.toJSON;

    // code from literate-markdown

    var old_CodeCell_create_element = CodeCell.prototype.create_element;
    CodeCell.prototype.create_element = function() {

        old_CodeCell_create_element.apply(this, arguments);

        var moduleName_element = $('<div>').addClass("module-name");
        this.input.append(moduleName_element);
        this.moduleName_element = moduleName_element;
        this.code_mirror.setOption('lineWrapping', true);

    }

    Notebook.prototype.execute_cell_and_select_below = function() {
        var indices = this.get_selected_cells_indices();
        var cell_index = -1;
        if (indices.length > 1) {
            this.execute_cells(indices);
            cell_index = Math.max.apply(Math, indices);
        } else {
            var cell = this.get_selected_cell();
            cell_index = this.find_cell_index(cell);
            cell.execute();
        }

    };

    var options_default = {
        cm_config: {
            extraKeys: {
                "Backspace": "delSpaceToPrevTabStop",
            },
            mode: 'markdown',
            //theme: 'ipython',
            matchBrackets: true,
            autoCloseBrackets: true,
            lineWrapping: true,
            lineNumbers: true
        },
        highlight_modes: {
            'magic_javascript': { 'reg': ['^%%javascript'] },
            'magic_perl': { 'reg': ['^%%perl'] },
            'magic_ruby': { 'reg': ['^%%ruby'] },
            'magic_python': { 'reg': ['^%%python3?'] },
            'magic_shell': { 'reg': ['^%%bash'] },
            'magic_r': { 'reg': ['^%%R'] },
            'magic_text/x-cython': { 'reg': ['^%%cython'] }
        }
    };

    CodeMirror.defaults = options_default.cm_config;

    var myMarkdownCell = function(kernel, options) {

        CodeCell.apply(this, [kernel, options]);

        // from MarkdownCell
        options = options || {};
        this.class_config = new configmod.ConfigWithDefaults(options.config, options_default, 'MarkdownCell');

        this.cell_type = 'markdown';
        this.drag_counter = 0;

        // from TextCell
        mathjaxutils = mathjaxutils;
        this.rendered = false;

    };

    textcell.MarkdownCell = myMarkdownCell;
    var MarkdownCell = textcell.MarkdownCell;

    MarkdownCell.prototype = Object.create(CodeCell.prototype);

    MarkdownCell.prototype.output_area = null;

    MarkdownCell.prototype.unrender = original_prototype.unrender;
    MarkdownCell.prototype.add_attachment = original_prototype.add_attachment
    MarkdownCell.prototype.select = original_prototype.select;
    MarkdownCell.prototype.get_text = original_prototype.get_text;
    MarkdownCell.prototype.set_text = original_prototype.set_text;
    MarkdownCell.prototype.get_rendered = original_prototype.get_rendered;
    MarkdownCell.prototype.set_rendered = original_prototype.set_rendered;
    MarkdownCell.prototype.set_heading_level = original_prototype.set_heading_level;
    MarkdownCell.prototype.insert_inline_image_from_blob = original_prototype.insert_inline_image_from_blob;
    MarkdownCell.prototype.bind_events = original_prototype.bind_events;

    var cell_prototype_unrender = Cell.prototype.unrender;
    Cell.prototype.unrender = function() {

        // unrender the cell only if it is not hidden
        if (!this.metadata.hide_input)
            return cell_prototype_unrender.call(this);
        else
            return false;
    }

    var perform_toggle = function(cell, animated) {

        var speed = animated ? 'fast' : 0;

        if (cell.rendered) {
            cell.element.find("div.text_cell_render").toggle(speed);
        } else {
            cell.element.find("div.input_area").toggle(speed);
            cell.code_mirror.refresh();
        }
    }

    var toggle_selected_input = function(cell) {

        perform_toggle(cell, true);
        cell.metadata.hide_input = !cell.metadata.hide_input;

    };

    MarkdownCell.prototype.create_element = function() {

        Cell.prototype.create_element.apply(this, arguments);
        var that = this;

        var cell = $('<div></div>').addClass('cell code_cell literate_cell');
        cell.attr('tabindex', '2');

        var input = $('<div></div>').addClass('input');
        this.input = input;

        var prompt_container = $('<div/>').addClass('prompt_container');

        var run_this_cell = $('<div></div>').addClass('run_this_cell');
        run_this_cell.prop('title', 'Run this cell');
        run_this_cell.append('<i class="fa-step-forward fa"></i>');
        run_this_cell.click(function(event) {
            event.stopImmediatePropagation();
            that.execute();
        });
        run_this_cell.prop('hidden', true);

        var hide_this_cell = $('<div></div>').addClass('hide_this_cell');
        hide_this_cell.prop('title', 'Hide this cell');
        hide_this_cell.append('<i class="fa-chevron-up fa"></i>');
        hide_this_cell.click(function(event) {
            event.stopImmediatePropagation();
            toggle_selected_input(that);
        });

        this.hide_this_cell = hide_this_cell;

        var prompt = $('<div/>').addClass('prompt input_prompt literate_prompt');

        var inner_cell = $('<div/>').addClass('inner_cell');
        this.celltoolbar = new celltoolbar.CellToolbar({
            cell: this,
            notebook: this.notebook
        });
        inner_cell.append(this.celltoolbar.element);
        var input_area = $('<div/>').addClass('input_area');
        this.code_mirror = new CodeMirror(input_area.get(0), options_default.cm_config);
        // In case of bugs that put the keyboard manager into an inconsistent state,
        // ensure KM is enabled when CodeMirror is focused:
        this.code_mirror.on('focus', function() {
            if (that.keyboard_manager) {
                that.keyboard_manager.enable();
            }

            that.code_mirror.setOption('readOnly', !that.is_editable());
        });
        this.code_mirror.on('keydown', $.proxy(this.handle_keyevent, this));
        $(this.code_mirror.getInputField()).attr("spellcheck", "true");
        inner_cell.append(input_area);

        // NEW
        var render_area = $('<div/>').addClass('text_cell_render rendered_html').attr('tabindex', '-1');
        inner_cell.append(render_area);

        prompt_container.append(prompt).append(hide_this_cell); //.append(run_this_cell);
        input.append(prompt_container).append(inner_cell);

        var output = $('<div></div>');
        cell.append(input).append(output);
        this.element = cell;
        this.output_area = new outputarea.OutputArea({
            config: this.config,
            selector: output,
            prompt_area: true,
            events: this.events,
            keyboard_manager: this.keyboard_manager,
        });
        this.completer = new completer.Completer(this, this.events);

        this.inner_cell = inner_cell;
        this.input_area = input_area;

        var moduleName_element = $('<div><div/>').addClass("module-name");
        this.input.append(moduleName_element);
        this.moduleName_element = moduleName_element;

    };

    MarkdownCell.prototype.set_input_prompt = function(number) {

    };

    var cell_to_execute;

    var CodeCell_execute_orig = CodeCell.prototype.execute;
    CodeCell.prototype.execute = function(stop_on_error) {

        cell_to_execute = this;
        return CodeCell_execute_orig.apply(this, [stop_on_error]);

    }

    var old_execute = Kernel.prototype.execute;
    Kernel.prototype.execute = function(code, callbacks, options) {

        //console.log("[agda-extension] Kernel.prototype.execute, user_expressions: " + options.user_expressions);

        if (typeof options.user_expressions === 'undefined')
            options.user_expressions = {};

        var notebookName = Jupyter.notebook.notebook_name;
        notebookName = notebookName.replace(".ipynb", "");
        options.user_expressions["notebookName"] = notebookName;

        //console.log("[agda-extension] notebook: " + JSON.stringify(Jupyter.notebook));

        if (cell_to_execute) {

            var cells = Jupyter.notebook.get_cells();
            var ids_before = [];

            /*
            //first semantics: collect all cells above this one
            var ncells = Jupyter.notebook.ncells();

            // find the id's of all cells above this one
            for (var i = 0; i < ncells; i++) {
                var cell = cells[i];
                if (cell.cell_id != cell_to_execute.cell_id) {
                    var len = cell.metadata.defaultPrequelLength;
                    // add this id only if the cell has the default prequel
                    if (len && len > 0)
                        ids_before.push(cell.metadata.id);
                } else
                    break;
            }*/

            // current semantics: collect all cells above this one
            // up to the first one which has an explicit module name

            var index = Jupyter.notebook.find_cell_index(cell_to_execute);
            var preamble = "{-# OPTIONS --allow-unsolved-metas #-} \n"
            preamble += "module " + notebookName + ".cell" + cell_to_execute.metadata.id + " where \n"
                //var preambleLength = 2;

            //console.log("[literate-markdown] cell_to_execute: " + JSON.stringify(cell_to_execute));

            for (var i = index - 1; i > 0; i--) {

                var cell = cells[i];

                //console.log("[literate-markdown] cell: " + JSON.stringify(cell));

                //preambleLength += 1;

                // use the automatically generated module name
                if (cell.metadata.preambleLength > 0) {
                    var imp = "open import " + notebookName + ".cell" + cell.metadata.id + " public \n";
                    //console.log("[literate-markdown] adding import to preamble (default): " + imp);
                    preamble += imp
                } else if (typeof cell.metadata.moduleName != 'undefined') {
                    var imp = "open import " + cell.metadata.moduleName + " public \n";
                    //console.log("[literate-markdown] adding import to preamble: " + imp);
                    preamble += imp
                    break;
                } else {
                    //console.log("[literate-markdown] skipping cell " + cell.metadata.id);
                }

            }

            options.user_expressions["cellId"] = cell_to_execute.metadata.id;
            options.user_expressions["preamble"] = preamble;

        } else {

            options.user_expressions["cellId"] = "";
            options.user_expressions["preamble"] = "";

        }

        return old_execute.apply(this, [code, callbacks, options]);
    }

    MarkdownCell.prototype.execute = function(stop_on_error) {

        var orig_text = this.get_text();
        var text = orig_text.replace(/^````.*$/, "````");

        //console.log("[agda-extension] execute cell");

        // extract blocks of code between executable code chunk markers "````"
        var blocks = text.split('````');
        var len = blocks.length;

        //console.log("[agda-extension] #blocks: " + len);

        // raise an error if there is an odd number of lines "````"
        // i.e., an even number of blocks
        if (len % 2 == 0) {
            //console.log("[literate-markdown] even number of blocks, exiting");
            var outputs = JSON.parse('[{ "output_type": "stream", "text": "", "name": "stdout" }]');
            outputs[0].text = "Error: unmatched executable code delimiter \"````\"";
            this.clear_output(false, true);
            this.output_area.fromJSON(outputs);
            return;

        }
        // we are interested in odd blocks        
        var code = "";
        for (var i = 0; i < blocks.length - 1; i++) {

            // even blocks contain markup code and are replaced by blank lines,
            // ***of the same length as the replaced line***
            // (this is important to preserve character counts when interfacing with the kernel);
            // this helps the kernel giving error messages with the correct line numbers
            if (i % 2 == 0) {
                var lines = blocks[i].split('\n');
                for (var j = 0; j < lines.length - 1; j++) {
                    //if(lines[j].length > 0)
                    code += " ".repeat(lines[j].length) + "\n";
                }
                code += "    "; // for "````"
            }
            // odd blocks contain executable code                
            else {
                code += blocks[i]; //.split("\n").slice(0,-1).join("\n");
                code += "    "
            }
        }

        //console.log("[agda-extension] executable code chunks: \n" + code);

        // it is important that the rest of the code below is executed only if code is not empty,
        // otherwise it will mess up with the undo history
        if (code == "") {
            this.rendered = false;
            MarkdownCell.prototype.render.call(this);
            return;
        }

        this.rendered = false;
        MarkdownCell.prototype.set_text.call(this, code);
        CodeCell.prototype.execute.call(this, stop_on_error);
        this.rendered = false;
        MarkdownCell.prototype.set_text.call(this, orig_text);
        MarkdownCell.prototype.render.call(this);

        //2 undo's for the two set_text's calls above + execute
        this.code_mirror.undo();
        this.code_mirror.undo();
        //        this.code_mirror.undo();

        this.auto_highlight();
        this.code_mirror.refresh();

    };

    MarkdownCell.prototype.render = function() {

        var text = this.get_text();
        var blocks = text.split('````');
        var code = "";

        // render only if it is not hidden
        if (this.metadata.hide_input) {
            //console.log("[literate-markdown] not rendering because hide_input = " + this.metadata.hide_input);
            //return;
        }

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
        } else
            code = text;

        this.unrender();
        this.code_mirror.setValue(code);
        var cont = original_render.apply(this);
        this.code_mirror.setValue(text);
        this.code_mirror.undo();
        this.code_mirror.undo();
        //        this.code_mirror.undo();

        //this.rendered = true;
        return cont;

    };

    MarkdownCell.prototype.fromJSON = function(data) {

        //console.log("[literate-markdown] called fromJSON");

        Cell.prototype.fromJSON.apply(this, arguments);
        if (data.cell_type === 'markdown') {

            if (data.attachments !== undefined) {
                this.attachments = data.attachments;
            }

            if (data.source !== undefined) {
                this.set_text(data.source);
                this.code_mirror.clearHistory();
                this.auto_highlight();
                this.set_rendered(data.rendered || '');
                render_cell(this);
            }

            if (data.execution_count !== undefined) {
                // this.set_input_prompt(data.execution_count);
            }

            this.output_area.trusted = data.metadata.trusted || false;

            // do not restore outputs for markdown cells
            //if (data.outputs !== undefined) {
            //    this.output_area.fromJSON(data.outputs, data.metadata);
            //}

        }
    };

    MarkdownCell.prototype.toJSON = function() {
        var data = original_toJSON.apply(this);
        return data;
    };

    Notebook.prototype.insert_cell_at_index = function(type, index) {

        //console.log("[literate-markdown] inserting a new cell of type: ", type);

        var ncells = this.ncells();
        index = Math.min(index, ncells);
        index = Math.max(index, 0);
        var cell = null;
        type = type || this.class_config.get_sync('default_cell_type');
        if (type === 'above') {
            if (index > 0) {
                type = this.get_cell(index - 1).cell_type;
            } else {
                type = 'code';
            }
        } else if (type === 'below') {
            if (index < ncells) {
                type = this.get_cell(index).cell_type;
            } else {
                type = 'code';
            }
        } else if (type === 'selected') {
            type = this.get_selected_cell().cell_type;
        }

        if (ncells === 0 || this.is_valid_cell_index(index) || index === ncells) {
            var cell_options = {
                events: this.events,
                config: this.config,
                keyboard_manager: this.keyboard_manager,
                notebook: this,
                tooltip: this.tooltip
            };
            switch (type) {
                case 'code':
                    cell = new codecell.CodeCell(this.kernel, cell_options);
                    cell.set_input_prompt();
                    break;
                case 'markdown':
                    cell = new myMarkdownCell(this.kernel, cell_options); // only change: added this.kernel as first argument
                    break;
                case 'raw':
                    cell = new textcell.RawCell(cell_options);
                    break;
                default:
                    log("Unrecognized cell type: ", type, cellmod);
                    cell = new cellmod.UnrecognizedCell(cell_options);
            }

            if (this._insert_element_at_index(cell.element, index)) {
                cell.render();
                this.events.trigger('create.Cell', { 'cell': cell, 'index': index });
                cell.refresh();
                // We used to select the cell after we refresh it, but there
                // are now cases were this method is called where select is
                // not appropriate. The selection logic should be handled by the
                // caller of the the top level insert_cell methods.
                this.set_dirty(true);
            }
        }
        return cell;

    };

    Notebook.prototype.to_code = function(index) {
        var i = this.index_or_selected(index);
        if (this.is_valid_cell_index(i)) {
            var source_cell = this.get_cell(i);
            if ( /*!(source_cell instanceof codecell.CodeCell)*/ source_cell.cell_type !== "code" && source_cell.is_editable()) { // only change
                var target_cell = this.insert_cell_below('code', i);
                var text = source_cell.get_text();
                if (text === source_cell.placeholder) {
                    text = '';
                }
                //metadata
                target_cell.metadata = source_cell.metadata;
                // attachments (we transfer them so they aren't lost if the
                // cell is turned back into markdown)
                target_cell.attachments = source_cell.attachments;

                target_cell.set_text(text);
                // make this value the starting point, so that we can only undo
                // to this state, instead of a blank cell
                target_cell.code_mirror.clearHistory();
                source_cell.element.remove();
                this.select(i);
                var cursor = source_cell.code_mirror.getCursor();
                target_cell.code_mirror.setCursor(cursor);
                this.set_dirty(true);
            }
        }
    };

    var upgrade_cell = function(cell, index) {

        //if (cell.cell_type === 'markdown') {

        //console.log("[agda-extension] reloading cell with index: " + index);

        var id = cell.metadata.id
        if (id) {
            idx = Math.max(idx, id);
        }

        var new_cell = Jupyter.notebook.insert_cell_above(cell.cell_type, index);
        new_cell.unrender();
        new_cell.set_text(cell.get_text());
        new_cell.metadata = JSON.parse(JSON.stringify(cell.metadata));
        var cell_index = Jupyter.notebook.find_cell_index(cell);
        Jupyter.notebook.delete_cell(cell_index);
        //render_cell(new_cell);
        new_cell.execute();

        //} else {
        //    cell.execute();
        //}

        var cm = cell.code_mirror;
        cm.setOption("lineWrapping", true);

        // hide the cell
        if (new_cell.metadata.hide_input) {
            //console.log("[agda-extension] new_cell hide_input: " + new_cell.metadata.hide_input);
            perform_toggle(new_cell, false);
        }

    }

    var render_cell = function(cell) {
        //var element = cell.element.find('div.text_cell_render');
        //var text = execute_python(cell, element[0].innerHTML);
        //if (text !== undefined) {
        //    element[0].innerHTML = text;
        //    MathJax.Hub.Queue(["Typeset",MathJax.Hub,element[0]]);
        //}
        //console.log("[literate-markdown] rendering cell");
        cell.rendered = false;
        cell.render();
    };

    /**
     * Update all references variables in markdown cells
     *
     */
    var update_md_cells = function() {
        var ncells = Jupyter.notebook.ncells();
        var cells = Jupyter.notebook.get_cells();

        for (var i = 0; i < ncells; i++) {
            var cell = cells[i];
            upgrade_cell(cell, i);
        }
    };

    var idx = 0;

    // when a new cell is created, generate a new unique id for this cell
    var onCreateCell = function(evt, data) {

        var cell = data.cell;
        var index = data.index;

        //("[agda-extension] onCreateCell, current id: " + idx);

        var id = cell.metadata.id
        if (id) {
            idx = Math.max(idx, id);
        } else
            cell.metadata.id = idx;

        idx += 1;

        //console.log("[agda-extension] onCreateCell, next id: " + idx);

    };

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

    //var orig_show = Tooltip.prototype._show;
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

        // empty the current contents of the agda pager
        $("#agda-pager-container").empty();

        var payload = content;

        if (payload.data['text/html'] && payload.data['text/html'] !== "") {
            Jupyter.pager.append(payload.data['text/html']);
            $("#agda-pager-container").append(payload.data['text/html']);

        } else if (payload.data['text/plain'] && payload.data['text/plain'] !== "") {
            Jupyter.pager.append_text(payload.data['text/plain']);
            $("#agda-pager-container").append(
                $('<pre/>').html(utils.fixConsole(utils.fixOverwrittenChars(payload.data['text/plain']))));
        }

        /*
        Jupyter.pager.pager_element.height('initial');
        Jupyter.pager.pager_element.show("fast", function() {
            Jupyter.pager.pager_element.height(Jupyter.pager.pager_element.height());
            Jupyter.pager._resize();
            Jupyter.pager.pager_element.css('position', 'relative');
            //window.requestAnimationFrame(function() { // Wait one frame
            Jupyter.pager.pager_element.css('position', '');
            //});
        });*/

        //this.showInPager(this._old_cell);
        //this.events.trigger('open_with_text.Pager', this._reply.content);

        $('#agda-pager').show();
        setAgdaNotebookWidth();

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

            cell.code_mirror.refresh();
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
            cell.code_mirror.refresh();
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

                // adjust if this cell uses a default prequel
                if (cell.metadata.preambleLength)
                    from -= Number(cell.metadata.preambleLength);

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

        //check that the kernel is Agda
        if (cell.kernel.name != "agda") {
            log("the kernel is " + cell.kernel.name + ", skipping");
            return;
        } else
            //console.log("[agda-extension] the kernel is " + cell.kernel.name + ", continuing");

        //console.log("[agda-extension] finished_execute_handler, outputs: " + JSON.stringify(outputs));

        if (outputs !== undefined && outputs[0] !== undefined) {
            var output = outputs[0].text;
            var new_output = process_new_output(cell, output);

            //console.log("[agda-extension] finished_execute_handler, original output: " + output + ", new output: " + new_output);

            outputs[0].text = new_output;
            cell.clear_output(false, true);
            cell.output_area.fromJSON(outputs, data.metadata);
        }

        var moduleName = cell.metadata.moduleName;
        //console.log("[agda-extension] finished_execute_handler, moduleName: " + moduleName);
    };

    var remove_all_highlights = function(cell) {

        var cm = cell.code_mirror;
        cm.eachLine(function(lineHandle) {
            cm.removeLineClass(lineHandle, "background", "compile-error");
            cm.removeLineClass(lineHandle, "background", "compile-hole");
            cell.moduleName_element.find(".module-name-text").removeClass("compile-error");
            cell.moduleName_element.find(".module-name-text").removeClass("compile-hole");
        });
        cell.metadata.codehighlighter = [];
        cell.metadata.code_hole_highlighter = [];
        cm.refresh();

    };

    var execute_handler = function(evt, data) {

        console.log("[agda-extension] execute_handler");

        // retrieve the contents of the output area
        var cell = data.cell;

        //check that the kernel is Agda
        if (cell.kernel.name != "agda") {
            log("[agda-extension] the kernel is " + cell.kernel.name + ", skipping");
            return;
        }
            //console.log("[agda-extension] the kernel is " + cell.kernel.name + ", continuing");

        cell.output_area.collapse();
        cell.output_area.do_not_expand = true;
        remove_all_highlights(cell);
        unmake_cell_green(cell);

    };

    var change_handler = function(evt, data) {

        //console.log("[agda-extension] change_handler");

        var cell = data.cell;
        var change = data.change;

        //check that the kernel is Agda
        if (cell.kernel === undefined) {
            //console.log("[agda-extension] kernel is undefined, skipping");
            return;
        } else if (cell.kernel.name != "agda") {
            //console.log("[agda-extension] the kernel is " + cell.kernel.name + ", skipping");
            return;
        }
            //console.log("[agda-extension] the kernel is " + cell.kernel.name + ", continuing");

        if (change) {

            unmake_cell_green(cell);
            //unmake_cell_yellow(cell);
            remove_all_highlights(cell);

        }

    };

    var shell_reply_handler = function(evt, data) {

        var reply = data.reply
        var content = reply.content;

        //console.log("shell_reply_handler reply.msg_id: " + reply.msg_id)
        //console.log("shell_reply_handler reply.parent_header.msg_id: " + reply.parent_header.msg_id)
        //console.log("shell_reply_handler CodeCell.msg_cells: " + CodeCell.msg_cells)

        //var index = IPython.notebook.get_selected_index();
        var cell = CodeCell.msg_cells[reply.parent_header.msg_id];

        // the current cell is the one before the selected one (not always!!)
        //var cell = IPython.notebook.get_cell(index - 1); 

        if (content && cell && cell.kernel.name == "agda") {

            //console.log("shell_reply_handler content:" + content);
            var user_expressions = content.user_expressions;

            if (user_expressions) {

                if ("fileName" in user_expressions) {
                    // save the module file name in the cell metadata
                    var fileName = user_expressions["fileName"];
                    cell.metadata.fileName = fileName;
                }

                if ("moduleName" in user_expressions) {
                    var moduleName = user_expressions["moduleName"];
                    cell.metadata.moduleName = moduleName;

                    // update the corresponding element

                    var moduleName_element = cell.moduleName_element;
                    moduleName_element.empty();

                    if (moduleName) {
                        // remove the notebook name part
                        var notebook_name = Jupyter.notebook.notebook_name.replace(".ipynb", "");
                        moduleName = moduleName.replace(notebook_name + ".", "");
                        // update the module name
                        var elem = $("<span>").css("white-space", "nowrap").text(moduleName).addClass("module-name-text");
                        //elem.append($("<a>").addClass("anchor-link").attr("href", "#" + moduleName).text("¶"));
                        //moduleName_element.append("<p style=\"white-space: nowrap\">" + moduleName + "</p>").find("p").addClass("module-name-text");
                        elem.attr('id', moduleName);
                        moduleName_element.append(elem);
                    } else {
                        var elem = $("<span>").text("undefined").addClass("module-name-text");
                        moduleName_element.append(elem);
                    }
                }

                if ("holes" in user_expressions) {
                    var holes = user_expressions["holes"];
                    //console.log("shell_reply_handler holes: " + holes);
                    cell.metadata.holes = holes;
                    for (const hole of cell.metadata.holes) {
                        //console.log("process_new_output hole: " + hole);
                        highlight_hole_in_cell_and_store_in_metadata(cell, hole);
                    }

                    // not very visible against white background
                    //if (holes.length > 0)
                    //    cell.moduleName_element.find(".module-name-text").addClass("compile-hole");
                    //else
                    //    cell.moduleName_element.find(".module-name-text").removeClass("compile-hole");

                }

                if ("isError" in user_expressions && user_expressions["isError"] == true) {
                    var isError = user_expressions["isError"];
                    //console.log("shell_reply_handler isError: " + isError);
                    cell.metadata.isError = isError;
                    moduleName_element.find(".module-name-text").addClass("compile-error");
                } else
                    moduleName_element.find(".module-name-text").removeClass("compile-error");

                // indicates that this cell uses a default preamble
                if ("preambleLength" in user_expressions) {
                    var preambleLength = user_expressions["preambleLength"];
                    cell.metadata.preambleLength = preambleLength;
                    //console.log("[agda-extension] updating to new preambleLength: " + preambleLength);
                }

            }

        }

        process_summary();
    }

    var link_click_callback = function(evt) {
        // workaround for https://github.com/jupyter/notebook/issues/699
        //console.log("[agda-extension] click on module name link");

        setTimeout(function() { $.ajax() }, 100);
        evt.preventDefault();
        var currentSection = $('#toc .highlight_on_scroll a').data('tocModifiedId')
        if (window.history.state != null) {
            if (window.history.state.back != currentSection) {
                window.history.pushState({ 'back': currentSection }, "", '')
            }
        }
        var trg_id = $(evt.currentTarget).attr('id');
        window.history.pushState({ 'back': trg_id }, "", '');
        window.history.lastjump = trg_id;

        var trg = document.getElementById(trg_id);
        teg.scrollIntoView(true);
        var cell = $(trg).closest('.cell').data('cell');
        Jupyter.notebook.select(Jupyter.notebook.find_cell_index(cell));
        highlight_toc_item("toc_link_click", {
            cell: cell
        });
    }

    function process_summary() {
        var cell_summary;
        var cells = IPython.notebook.get_cells();
        var lcells = cells.length;
        for (var i = 0; i < lcells; i++) {
            if (cells[i].metadata.summary) {
                cell_summary = cells[i];
                break;
            }
        }

        if (cell_summary === undefined) {
            cell_summary = IPython.notebook.insert_cell_above('markdown', 0);
            cell_summary.metadata.summary = true;
        }

        var module_names = $('.module-name-text').clone().removeClass('module-name-text').addClass('module-name-text-summary');
        // $("#notebook").find("p.module-name-text");

        var text = $("<div></div>");
        module_names.each(function(i) {
            var value = $(this).text();
            $(this).removeAttr('id');
            //console.log("[agda-extension] module-name-text value: " + value);

            var a = $("<a>").attr("href", "#" + value);

            // workaround does not work because html inside markdown cells is sanitized and the callback below is not called
            a.on('click', link_click_callback);
            a.append($(this))

            text.append(a);

            if (i < module_names.length - 1)
                text.append($('<span>').text(", ").addClass('module-name-text-summary'));
        });

        var new_html = '<h6>' + $('<div>').text("Summary").html() + '<span class="summary"></span></h6>' + text.html() + '\n';
        //'<div class="toc">' +
        //$('#toc').html() +
        //'</div>';

        cell_summary.set_text(new_html);
        cell_summary.render();

        $("a").find(".anchor-link").text("");
    }

    function setAgdaNotebookWidth(cfg, st) {
        var margin = 10;
        var nb_inner = $('#notebook-container');
        var nb_wrap_w = $('#notebook').width();
        var sidebar = $('#agda-pager');
        var visible_sidebar = sidebar.is(':visible');
        var sidebar_w = visible_sidebar ? sidebar.outerWidth() : 0;
        var available_space = nb_wrap_w - 2 * margin - sidebar_w;
        var nb_inner_w = nb_inner.outerWidth();
        var inner_css = { marginLeft: '', width: '' };

        //console.log("[agda-extension] nb_wrap_w: " + nb_wrap_w);
        //console.log("[agda-extension] sidebar_w: " + sidebar_w);
        //console.log("[agda-extension] available_space: " + available_space);
        //console.log("[agda-extension] nb_inner_w: " + nb_inner_w);
        //console.log("[agda-extension] visible_sidebar: " + visible_sidebar);

        if (visible_sidebar) {

            //var nb_left_w = nb_inner.css('padding-left') + nb_inner.css('margin-left') + nb_wrap_w; //nb_inner.width();
            if (available_space <= nb_inner_w + sidebar_w) {

                //var marginLeft = nb_inner.outerWidth() + 200 /*- nb_inner.css('margin-left') - nb_inner.css('padding-left')*/ + margin;
                //var marginRight = nb_inner.outerWidth() + 200 /*- nb_inner.css('margin-left') - nb_inner.css('padding-left')*/ + margin;
                //console.log("[agda-extension] resizing #agda-pager, marginLeft = " + marginLeft);

                // shift notebook to the left
                // inner_css.marginRight = sidebar_w + margin;

                // shift notebook to the right
                inner_css.marginLeft = sidebar_w + margin;
                //console.log("[agda-extension] shifting nb to the right, marginLeft: " + inner_css.marginLeft);

                //inner_css.marginLeft = nb_inner_w - inner_css.marginRight - nb_inner.width();

                //sidebar.css('margin-left', marginLeft + 'px');
                //sidebar.css('margin-right', '10px');

                //if (available_space <= nb_inner_w) {
                // slim notebook if necessary
                //    inner_css.width = available_space;
                //    console.log("[agda-extension] slimming nb, width: " + inner_css.width);
                //}
            }
        } else {
            inner_css.marginLeft = 'auto'
        }

        nb_inner.css(inner_css);
    }

    var agda_init = function() {
        Jupyter.notebook.config.loaded.then(function() {

            update_md_cells();
    
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

            var agda_pager = $('<div id="agda-pager"/>')
                .css('display', 'none')
                .append(
                    $('<a>').attr('role', "button")
                    .attr('title', i18n.msg._("close"))
                    .addClass('ui-button')
                    .click(function() {
                        $('#agda-pager').hide();
                        setAgdaNotebookWidth();
                    })
                    .append($('<span>').addClass("ui-icon ui-icon-close"))
                )
                .append(
                    $('<div id = "agda-pager-container" class = "agda-pager-container"><div/>'))
                //.prependTo('#notebook-container');
                .prependTo('#site');

            /*agda_pager.resizable({
                handles: 'e', // only the east handle is available
                resize: function(event, ui) {
                    //if (cfg.sideBar) {
                    // unset the height set by jquery resizable
                    //$('#agda-pager').css('height', '');
                    $('#agda-pager').css('width', '');
                    //setAgdaNotebookWidth();
                    //}
                },
                start: function(event, ui) {
                    //if (!cfg.sideBar) {
                    //    cfg.toc_section_display = setMd('toc_section_display', true);
                    //    makeUnmakeMinimized(cfg);
                    //}
                },
                stop: function() {},
                containment: 'parent',
                minHeight: 100,
                minWidth: 250,
            });*/

            //agda_pager.children('.ui-resizable-e').toggleClass('ui-icon ui-icon-grip-dotted-vertical', true);

            setAgdaNotebookWidth();

            var callbackPageResize = function(evt) {
                setAgdaNotebookWidth();
            };

            $(window).on('resize', callbackPageResize);

            events.on("resize-header.Page toggle-all-headers", callbackPageResize);
            events.on("create.Cell", onCreateCell);
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
        //("[agda-extension] rendered_handler");
        var cell = data.cell;

        if (cell.kernel !== undefined && cell.kernel.name == "agda")
            cell.element.find('div.text_cell_render pre').each(function(index, value) {
                //console.log($(this));
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

    var log = function(msg) {
        console.log("[agda-extension] " + msg);
                
    }

    var load_ipython_extension = function() {
        load_css();

        Jupyter.notebook.config.loaded.then(function() {
            if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
                log("Notebook fully loaded -- agda-extension initialized");
                agda_init();
            } else {
                events.on("notebook_loaded.Notebook", function() {
                    log("agda-extension initialized (via notebook_loaded)");
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