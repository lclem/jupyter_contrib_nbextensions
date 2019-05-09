
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

    var LiterateCell = function (kernel, options) {

        this.config = options.config;
        this.class_config = new configmod.ConfigWithDefaults(this.config, LiterateCell.options_default, 'LiterateCell');

        CodeCell.call(this, kernel, options);
        MarkdownCell.call(this, options);

        // Attributes we want to override in this subclass.
        this.cell_type = 'literate';
        this.rendered = false;
        var that = this;

    };

    LiterateCell.options_default = {
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

    LiterateCell.prototype = Object.create(CodeCell.prototype);

    LiterateCell.prototype.output_area = null;

    LiterateCell.prototype.set_rendered = TextCell.prototype.set_rendered;
    LiterateCell.prototype.unrender = MarkdownCell.prototype.unrender;
    LiterateCell.prototype.add_attachment = MarkdownCell.prototype.add_attachment
    LiterateCell.prototype.select = MarkdownCell.prototype.select;
    LiterateCell.prototype.set_text = MarkdownCell.prototype.set_text;
    LiterateCell.prototype.get_rendered = MarkdownCell.prototype.get_rendered;
    LiterateCell.prototype.set_heading_level = MarkdownCell.prototype.set_heading_level;
    LiterateCell.prototype.insert_inline_image_from_blob = MarkdownCell.prototype.insert_inline_image_from_blob;
    LiterateCell.prototype.bind_events = MarkdownCell.prototype.bind_events;
    //LiterateCell.prototype.fromJSON = MarkdownCell.prototype.fromJSON;
    //LiterateCell.prototype.toJSON = MarkdownCell.prototype.toJSON;

    LiterateCell.prototype.create_element = function () {

        CodeCell.prototype.create_element_core.call(this, 'literate_cell', LiterateCell.options_default.cm_config);

        // activate spell checking on the markdown area
        $(this.code_mirror.getInputField()).attr("spellcheck", "true"); 

        var render_area = $('<div/>').addClass('text_cell_render rendered_html').attr('tabindex','-1');
        this.inner_cell.append(render_area); 

    };

    LiterateCell.prototype.execute = function (stop_on_error) {

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

        CodeCell.prototype.execute_core.call(this, stop_on_error, code);
        LiterateCell.prototype.render.call(this);

    };

    LiterateCell.prototype.render = function () {

        console.log("LiterateCell.prototype.render")

        var text = this.get_text();
        var blocks = text.split('````');
        var code = "";

        if (blocks.length > 0 && this.kernel) {

            var kernel = this.kernel.name;
            console.log("Current kernel: " + kernel);
    
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

        //console.log("Extracted executable code chunks: \n" + code);

        var cont = CodeCell.prototype.render.apply(this, arguments);
        cont = MarkdownCell.prototype.render_core.call(this, code);
        return cont;
        
    };

    LiterateCell.prototype.fromJSON = function (data) {
        Cell.prototype.fromJSON.apply(this, arguments);
        if (data.cell_type === 'literate') { // NEW

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

    LiterateCell.prototype.toJSON = function () {
        var data = MarkdownCell.prototype.toJSON.apply(this);

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

    return {'LiterateCell' : LiterateCell};

});

