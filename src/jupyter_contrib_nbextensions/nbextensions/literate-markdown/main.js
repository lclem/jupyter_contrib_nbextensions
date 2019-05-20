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

    var original_MarkdownCell = textcell.MarkdownCell;
    var original_prototype = original_MarkdownCell.prototype;
    var original_render = original_prototype.render;
    var original_create_element = original_prototype.create_element;
    var original_fromJSON = original_prototype.fromJSON;
    var original_toJSON = original_prototype.toJSON;

    var options_default = {
        cm_config : {
            extraKeys: {
                "Backspace" : "delSpaceToPrevTabStop",
            },
            // mode: 'ipythongfm',
            // mode: 'htmlmixed',
            mode: 'markdown',
            //theme: 'ipython',
            matchBrackets: true,
            autoCloseBrackets: true,
            lineWrapping : true,
            lineNumbers : true
        },
        highlight_modes : {
            'magic_javascript'    :{'reg':['^%%javascript']},
            'magic_perl'          :{'reg':['^%%perl']},
            'magic_ruby'          :{'reg':['^%%ruby']},
            'magic_python'        :{'reg':['^%%python3?']},
            'magic_shell'         :{'reg':['^%%bash']},
            'magic_r'             :{'reg':['^%%R']},
            'magic_text/x-cython' :{'reg':['^%%cython']}
        }
    };

    var myMarkdownCell = function (kernel, options) {

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

    MarkdownCell.prototype.create_element = function () {
    
        /*
        CodeCell.prototype.create_element.apply(this, arguments);
        var cell = this.element;
        */

        Cell.prototype.create_element.apply(this, arguments);
        var that = this;

        var cell =  $('<div></div>').addClass('cell code_cell literate_cell');
        cell.attr('tabindex','2');

        var input = $('<div></div>').addClass('input');
        this.input = input;

        var prompt_container = $('<div/>').addClass('prompt_container');

        var run_this_cell = $('<div></div>').addClass('run_this_cell');
        run_this_cell.prop('title', 'Run this cell');
        run_this_cell.append('<i class="fa-step-forward fa"></i>');
        run_this_cell.click(function (event) {
            event.stopImmediatePropagation();
            that.execute();
        });

        var prompt = $('<div/>').addClass('prompt input_prompt literate_prompt');

        var inner_cell = $('<div/>').addClass('inner_cell');
        this.celltoolbar = new celltoolbar.CellToolbar({
            cell: this, 
            notebook: this.notebook});
        inner_cell.append(this.celltoolbar.element);
        var input_area = $('<div/>').addClass('input_area');
        this.code_mirror = new CodeMirror(input_area.get(0), options_default.cm_config);
        // In case of bugs that put the keyboard manager into an inconsistent state,
        // ensure KM is enabled when CodeMirror is focused:
        this.code_mirror.on('focus', function () {
            if (that.keyboard_manager) {
                that.keyboard_manager.enable();
            }

            that.code_mirror.setOption('readOnly', !that.is_editable());
        });
        this.code_mirror.on('keydown', $.proxy(this.handle_keyevent,this));
        $(this.code_mirror.getInputField()).attr("spellcheck", "true");
        inner_cell.append(input_area);

        // NEW
        var render_area = $('<div/>').addClass('text_cell_render rendered_html').attr('tabindex','-1');
        inner_cell.append(render_area);

        prompt_container.append(prompt).append(run_this_cell);
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

       //original_prototype.create_element.apply(this, arguments);

       /* How to set this up in code?
        .code_cell.rendered .input_area {
            display: none;
        }

        .code_cell.unrendered .text_cell_render {
            display: none;
        }
        */

    };

    MarkdownCell.prototype.set_input_prompt = function (number) {
        
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

    MarkdownCell.prototype.execute = function (stop_on_error) {

        var orig_text = this.get_text();
        var text = orig_text.replace(/^````.*$/, "````");

        //console.log("[literate-markdown] execute, current text: " + text);

        // extract blocks of code between executable code chunk markers "````"
        var blocks = text.split('````');

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
                    code += " ".repeat(lines[j].length) +  "\n";
                }
                code += "    "; // for "````"
            }
            // odd blocks contain executable code                
            else {
                code += blocks[i]; //.split("\n").slice(0,-1).join("\n");
                code += "    "
            }
        }

        //console.log("Extracted executable code chunks: \n" + code);

        this.rendered = false;
        MarkdownCell.prototype.set_text.call(this, code);
        CodeCell.prototype.execute.call(this, stop_on_error);
        this.rendered = false;
        MarkdownCell.prototype.set_text.call(this, orig_text);
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

    MarkdownCell.prototype.fromJSON = function (data) {

        //console.log("[literate-markdown] called fromJSON");

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

            // do not restore outputs for markdown cells
            //if (data.outputs !== undefined) {
            //    this.output_area.fromJSON(data.outputs, data.metadata);
            //}
        }
    };

    MarkdownCell.prototype.toJSON = function () {
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

    Notebook.prototype.insert_cell_at_index = function(type, index){

        //console.log("[literate-markdown] inserting a new cell of type: ", type);

        var ncells = this.ncells();
        index = Math.min(index, ncells);
        index = Math.max(index, 0);
        var cell = null;
        type = type || this.class_config.get_sync('default_cell_type');
        if (type === 'above') {
            if (index > 0) {
                type = this.get_cell(index-1).cell_type;
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
            switch(type) {
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

            if(this._insert_element_at_index(cell.element,index)) {
                cell.render();
                this.events.trigger('create.Cell', {'cell': cell, 'index': index});
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

    Notebook.prototype.to_code = function (index) {
        var i = this.index_or_selected(index);
        if (this.is_valid_cell_index(i)) {
            var source_cell = this.get_cell(i);
            if (/*!(source_cell instanceof codecell.CodeCell)*/ source_cell.cell_type !== "code" && source_cell.is_editable()) { // only change
                var target_cell = this.insert_cell_below('code',i);
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

        if (cell.cell_type === 'markdown') {

            //console.log("[literate-markdown] upgrading cell");

            var new_cell = Jupyter.notebook.insert_cell_above(cell.cell_type, index);
            new_cell.unrender();
            new_cell.set_text(cell.get_text());
            new_cell.metadata = JSON.parse(JSON.stringify(cell.metadata));
            var cell_index = Jupyter.notebook.find_cell_index(cell);
            Jupyter.notebook.delete_cell(cell_index);
            render_cell(new_cell);

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
    var update_md_cells = function () {
        var ncells = Jupyter.notebook.ncells();
        var cells = Jupyter.notebook.get_cells();

        var x = document.getElementsByClassName('text_cell');

        var i;
        for (i = 0; i < x.length; i++) {

            //x[i].classList.add('code_cell');
            //x[i].classList.add('literate_cell');
            //x[i].classList.remove('text_cell');

        }

        for (var i = 0; i < ncells; i++) {
            var cell = cells[i];
            var element = cell.element;


            //var text = cell.element.getElementById('text');
//                text.classList.remove('hidden');
//                text.classList.add('show');

            upgrade_cell(cell, i);
        }


    };

    var literate_init = function() {
        // read configuration, then call toc
        Jupyter.notebook.config.loaded.then(function () {

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
    }

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

        events.on("kernel_ready.Kernel", function () {
            if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
                console.log("[literate-markdown] Notebook fully loaded --  literate-markdown initialized");
                literate_init();
            } else {
                events.on("notebook_loaded.Notebook", function () {
                console.log("[literate-markdown] literate-markdown initialized (via notebook_loaded)");
                literate_init();
                })
            }
        })       
    };

    return {
        load_ipython_extension : load_ipython_extension
    };

});