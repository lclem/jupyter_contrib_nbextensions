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
    CodeMirror,
    cmpython,
    cmip
) {
    "use strict";

    var Kernel = kernel.Kernel;
    var Cell = cell.Cell;
    var CodeCell = codecell.CodeCell;
    var TextCell = textcell.TextCell;
    var Notebook = notebook.Notebook;

    var original_MarkdownCell = textcell.MarkdownCell;
    var original_prototype = original_MarkdownCell.prototype;
    var original_render = original_prototype.render;
    var original_create_element = original_prototype.create_element;
    var original_fromJSON = original_prototype.fromJSON;
    var original_toJSON = original_prototype.toJSON;

    //var original_execute_cell_and_select_below = Notebook.prototype.execute_cell_and_select_below;

    var old_CodeCell_create_element = CodeCell.prototype.create_element;
    CodeCell.prototype.create_element = function() {

        old_CodeCell_create_element.apply(this, arguments);
        var cell = this.element;

        var moduleName_element = $('<div><div/>').addClass("module-name");
        //filename_element.append("<p> ciao ciao </p>");

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

        /*
        // If we are at the end always insert a new cell and return
        if (cell_index === (this.ncells()-1)) {
            this.command_mode();
            this.insert_cell_below();
            this.select(cell_index+1);
            this.edit_mode();
            this.scroll_to_bottom();
            this.set_dirty(true);
            return;
        }

        this.command_mode();
        this.select(cell_index+1);
        this.focus_cell();
        this.set_dirty(true);
        */
    };

    var options_default = {
        cm_config: {
            extraKeys: {
                "Backspace": "delSpaceToPrevTabStop",
            },
            // mode: 'ipythongfm',
            // mode: 'htmlmixed',
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

        //console.log("[literate-markdown] creating new MarkdownCell");

        CodeCell.apply(this, [kernel, options]);
        //original_MarkdownCell.call(this, options);

        // from MarkdownCell
        options = options || {};
        //var config_default = utils.mergeopt(TextCell, options_default);
        this.class_config = new configmod.ConfigWithDefaults(options.config, options_default, 'MarkdownCell');
        //TextCell.apply(this, [$.extend({}, options, {config: options.config})]);

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

        //if (cell.metadata.hide_input)
        // make the button permanently visible
        //cell.hide_this_cell.visibility = "visible";
        //cell.hide_this_cell.show();
        //else
        //    cell.hide_this_cell.visibility = "hidden";

    };

    MarkdownCell.prototype.create_element = function() {

        /*
        CodeCell.prototype.create_element.apply(this, arguments);
        var cell = this.element;
        */

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

        //var inner_cell = cell.find('div.inner_cell');

        this.inner_cell = inner_cell;
        this.input_area = input_area;

        //original_prototype.create_element.apply(this, arguments);

        /* How to set this up in code?
         .code_cell.rendered .input_area {
             display: none;
         }

         .code_cell.unrendered .text_cell_render {
             display: none;
         }
         */

        var moduleName_element = $('<div><div/>').addClass("module-name");
        this.input.append(moduleName_element);
        this.moduleName_element = moduleName_element;

    };

    MarkdownCell.prototype.set_input_prompt = function(number) {

        /*var nline = 1;
        if (this.code_mirror !== undefined) {
           nline = this.code_mirror.lineCount();
        }
        this.input_prompt_number = number;
        var prompt_html = CodeCell.input_prompt_function(this.input_prompt_number, nline);

        // This HTML call is okay because the user contents are escaped.
        this.element.find('div.input_prompt').html(prompt_html);
        this.events.trigger('set_dirty.Notebook', {value: true});
        */

    };

    var cell_to_execute;

    var CodeCell_execute_orig = CodeCell.prototype.execute;
    CodeCell.prototype.execute = function(stop_on_error) {

        console.log("[literate-markdown] CodeCell.prototype.execute");

        cell_to_execute = this;
        return CodeCell_execute_orig.apply(this, [stop_on_error]);

    }

    var old_execute = Kernel.prototype.execute;
    Kernel.prototype.execute = function(code, callbacks, options) {

        console.log("[literate-markdown] Kernel.prototype.execute, user_expressions: " + options.user_expressions);

        if (typeof options.user_expressions === 'undefined')
            options.user_expressions = {};

        var notebookName = Jupyter.notebook.notebook_name;
        notebookName = notebookName.replace(".ipynb", "");
        options.user_expressions["notebookName"] = notebookName;

        //console.log("[literate-markdown] notebook: " + JSON.stringify(Jupyter.notebook));

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

            console.log("[literate-markdown] cell_to_execute: " + JSON.stringify(cell_to_execute));

            for (var i = index - 1; i > 0; i--) {

                var cell = cells[i];

                //console.log("[literate-markdown] cell: " + JSON.stringify(cell));

                //preambleLength += 1;

                // use the automatically generated module name
                if (cell.metadata.preambleLength > 0) {
                    var imp = "open import " + notebookName + ".cell" + cell.metadata.id + " public \n";
                    console.log("[literate-markdown] adding import to preamble (default): " + imp);
                    preamble += imp
                } else if (typeof cell.metadata.moduleName != 'undefined') {
                    var imp = "open import " + cell.metadata.moduleName + " public \n";
                    console.log("[literate-markdown] adding import to preamble: " + imp);
                    preamble += imp
                    break;
                } else {
                    console.log("[literate-markdown] skipping cell " + cell.metadata.id);
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

        console.log("[literate-markdown] execute cell");

        // extract blocks of code between executable code chunk markers "````"
        var blocks = text.split('````');
        var len = blocks.length;

        console.log("[literate-markdown] #blocks: " + len);

        // raise an error if there is an odd number of lines "````"
        // i.e., an even number of blocks
        if (len % 2 == 0) {
            console.log("[literate-markdown] even number of blocks, exiting");
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

        console.log("[literate-markdown] executable code chunks: \n" + code);

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

        /* ignore for now
        // is finite protect against undefined and '*' value
        if (isFinite(this.input_prompt_number)) {
            data.execution_count = this.input_prompt_number;
        } else {
            data.execution_count = null;
        }
        */

        // do not restore output for markdown cells
        /*
        var outputs = this.output_area.toJSON();
        data.outputs = outputs;
        data.metadata.trusted = this.output_area.trusted;
        if (this.output_area.collapsed) {
            data.metadata.collapsed = this.output_area.collapsed;
        } else {
            delete data.metadata.collapsed;
        }
        if (this.output_area.scroll_state === 'auto') {
            delete data.metadata.scrolled;
        } else {
            data.metadata.scrolled = this.output_area.scroll_state;
        }
        */
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
                    console.log("Unrecognized cell type: ", type, cellmod);
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

        console.log("[literate-markdown] reloading cell with index: " + index);

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
            console.log("[literate-markdown] new_cell hide_input: " + new_cell.metadata.hide_input);
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

        //var x = document.getElementsByClassName('text_cell');

        //var i;
        //for (i = 0; i < x.length; i++) {

        //x[i].classList.add('code_cell');
        //x[i].classList.add('literate_cell');
        //x[i].classList.remove('text_cell');

        //}

        for (var i = 0; i < ncells; i++) {
            var cell = cells[i];
            //var element = cell.element;


            //var text = cell.element.getElementById('text');
            //                text.classList.remove('hidden');
            //                text.classList.add('show');

            upgrade_cell(cell, i);
        }


    };

    var literate_init = function() {
        // read configuration, then call toc
        Jupyter.notebook.config.loaded.then(function() {

            update_md_cells();

            //events.on("rendered.MarkdownCell", function(evt, data) {
            //    var cell = $(data.cell);;
            //    render_cell(cell);
            //});
        });

        // event: on cell selection, highlight the corresponding item
        //events.on('select.Cell', highlight_toc_item);
        // event: if kernel_ready (kernel change/restart): add/remove a menu item
        //events.on("kernel_ready.Kernel", function() { })
        // events.on('execute.CodeCell', highlight_toc_item);

        events.on("create.Cell", onCreateCell);

    }

    var idx = 0;

    // when a new cell is created, generate a new unique id for this cell
    var onCreateCell = function(evt, data) {

        var cell = data.cell;
        var index = data.index;

        console.log("[literate-markdown] onCreateCell, current id: " + idx);

        var id = cell.metadata.id
        if (id) {
            idx = Math.max(idx, id);
        } else
            cell.metadata.id = idx;

        idx += 1;

        console.log("[literate-markdown] onCreateCell, next id: " + idx);

        //console.log("[literate-markdown] onCreateCell, metadata: " + JSON.stringify(cell.metadata));

    };

    var load_css = function() {
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = requirejs.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    var load_ipython_extension = function() {
        load_css();
        //events.on("rendered.MarkdownCell", function (event, data) {
        //    render_cell(data.cell);
        // });
        // events.on("trust_changed.Notebook", set_trusted_indicator);

        // $('#save_widget').append('<i id="notebook-trusted-indicator" class="fa fa-question notebook-trusted" />');
        // set_trusted_indicator();

        /* Show values stored in metadata on reload */

        events.on("kernel_ready.Kernel", function() {
            if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
                console.log("[literate-markdown] Notebook fully loaded --  literate-markdown initialized");
                literate_init();
            } else {
                events.on("notebook_loaded.Notebook", function() {
                    console.log("[literate-markdown] literate-markdown initialized (via notebook_loaded)");
                    literate_init();
                })
            }
        })
    };

    return {
        load_ipython_extension: load_ipython_extension
    };

});