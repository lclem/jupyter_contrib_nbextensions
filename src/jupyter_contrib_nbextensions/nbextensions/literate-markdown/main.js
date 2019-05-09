
define([
    'jquery',
    'base/js/namespace',
    'base/js/utils',
    'base/js/i18n',
    'base/js/keyboard',
    'services/config',
    'notebook/js/cell',
    'notebook/js/textcell',
    'notebook/js/codecell',
    'notebook/js/outputarea',
    'notebook/js/completer',
    'notebook/js/celltoolbar',
    'codemirror/lib/codemirror',
    'codemirror/mode/python/python',
    'notebook/js/codemirror-ipython'
], function(
    $,
    IPython,
    utils,
    i18n,
    keyboard,
    configmod,
    cell,
    textcell,
    codecell,
    outputarea,
    completer,
    celltoolbar,
    CodeMirror,
    cmpython,
    cmip
    ) {
    "use strict";
    
    var Cell = cell.Cell;
    var CodeCell = codecell.CodeCell;
    var MarkdownCell = textcell.MarkdownCell;
    var TextCell = textcell.TextCell;

    MarkdownCell.options_default = {
        cm_config : {
            extraKeys: {
                "Backspace" : "delSpaceToPrevTabStop",
            },
            mode: 'ipythongfm', //'htmlmixed',
//            theme: 'ipython',
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
            'magic_text/x-cython' :{'reg':['^%%cython']},
        },
    };

    CodeCell.msg_cells = {};

    var old_prototype = MarkdownCell.prototype;
    MarkdownCell.prototype = Object.create(CodeCell.prototype);
    
    MarkdownCell.prototype.output_area = null;

    MarkdownCell.prototype.set_rendered = TextCell.prototype.set_rendered;
    MarkdownCell.prototype.unrender = old_prototype.unrender;
    MarkdownCell.prototype.add_attachment = old_prototype.add_attachment
    MarkdownCell.prototype.select = old_prototype.select;
    MarkdownCell.prototype.set_text = old_prototype.set_text;
    MarkdownCell.prototype.get_rendered = old_prototype.get_rendered;
    MarkdownCell.prototype.set_heading_level = old_prototype.set_heading_level;
    MarkdownCell.prototype.insert_inline_image_from_blob = old_prototype.insert_inline_image_from_blob;
    MarkdownCell.prototype.bind_events = old_prototype.bind_events;

    var original_create_element = MarkdownCell.prototype.create_element;
    MarkdownCell.prototype.create_element = function () {

        original_create_element.call(this);
        var cell = this.element;
        
        var output = $('<div></div>');
        cell.append(output);
        
        this.output_area = new outputarea.OutputArea({
            config: this.config,
            selector: output,
            prompt_area: true,
            events: this.events,
            keyboard_manager: this.keyboard_manager,
        });
        this.completer = new completer.Completer(this, this.events);
        
    };

    MarkdownCell.prototype.execute = function (stop_on_error) {

        var text = this.get_text();
        //console.log("Current text: " + text);

        // extract blocks of code between executable code chunks markers "````"
        var blocks = text.split('````');

        // we are interested in odd blocks        
        var code = "";
        for (var i = 0; i < blocks.length; i++) {

            // even blocks contain markup code and are replaced by blank lines;
            // this helps the kernel giving error messages with the correct line numbers
            if (i % 2 == 0) { 
                var lines = blocks[i].split('\n');
                for (var j = 0; j < lines.length; j++) {
                    code += "\n";
                }
            }
            else // odd blocks contain executable code
                code += blocks[i];
        }

        //console.log("Extracted executable code chunks: \n" + code);

        set_text.call(this, code);
        CodeCell.prototype.execute.call(this, stop_on_error);
        set_text.call(this, text);
        render.call(this);

    };

    var original_render = MarkdownCell.prototype.render;
    MarkdownCell.prototype.render = function () {

        var text = this.get_text();
        var blocks = text.split('````');
        var code = "";

        if (blocks.length > 0 && this.kernel) {

            var kernel = this.kernel.name;
            //console.log("Current kernel: " + kernel);
    
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
            code = text

        var cont = CodeCell.prototype.render.apply(this, arguments);
        set_text.apply(this, code);
        cont = original_render.call(this);
        set_text.apply(this, text);
        return cont;
        
    };

    var original_fromJSON = MarkdownCell.prototype.fromJSON;
    MarkdownCell.prototype.fromJSON = function (data) {
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
                this.rendered = false;
                this.render();
            }

            this.set_input_prompt(data.execution_count);
            this.output_area.trusted = data.metadata.trusted || false;
            this.output_area.fromJSON(data.outputs, data.metadata);
        }
    };

    var original_toJSON = MarkdownCell.prototype.toJSON;
    MarkdownCell.prototype.toJSON = function () {
        var data = original_toJSON.apply(this);

        // is finite protect against undefined and '*' value
        if (isFinite(this.input_prompt_number)) {
            data.execution_count = this.input_prompt_number;
        } else {
            data.execution_count = null;
        }
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
        return data;
    };

   var load_ipython_extension = function() {
        // load_css('./main.css');
        // events.on("rendered.MarkdownCell", function (event, data) {
        //    render_cell(data.cell);
        // });
        // events.on("trust_changed.Notebook", set_trusted_indicator);

        // $('#save_widget').append('<i id="notebook-trusted-indicator" class="fa fa-question notebook-trusted" />');
        // set_trusted_indicator();

        /* Show values stored in metadata on reload */
        events.on("kernel_ready.Kernel", function () {
            if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
                // update_md_cells()
            } else {
                events.on("notebook_loaded.Notebook", function () {
                    // update_md_cells()
                })
            }
        });
    };

    return {
        load_ipython_extension : load_ipython_extension
    };

});

