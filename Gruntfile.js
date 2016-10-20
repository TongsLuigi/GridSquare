module.exports = function(grunt) {
    grunt.loadNpmTasks('grunt-typescript');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-bower-task');

    grunt.initConfig({
        'typescript': {
            'base': {
                'src': ['src/ts/*.ts'],
                'dest': 'public/src/ts/',
                'options': {
                    'module': 'amd',
                    'target': 'es5'
                }
            }
        },
        bower: {
            install: {
                options: {
                    targetDir: 'public/src/lib',
                    layout: 'byType',
                    install: true,
                    verbose: false,
                    cleanTargetDir: true,
                    cleanBowerDir: false
                }
            }
        },
        cssmin: {
            pc: {
                src: ['src/css/*.css'],
                dest: 'public/src/css/pc.min.css'
            }
        },
        watch: {
            css_pc: {
                files: 'src/css/*',
                tasks: ['cssmin']
            },
            ts: {
                files: ['src/ts/*'],
                tasks: ['typescript']
            },
            js: {
                files: ['src/js/base.js', 'src/js/angular_gridsquares_api.js', 'src/js/angular_gridsquares_app.js'],
                tasks: ['uglify']
            }
        },
        uglify: {
            build: {
                options: {
                    //banner: grunt.file.read('src/js/License.js'),
                    beautify: false,/*リリース時は圧縮等かける*/
                    compress: false,
                    mangle: false
                },
                src: "src/js/*.js",
                dest: 'public/src/js/main.min.js'
            }
        }
    });

    grunt.registerTask('srcs', ['typescript', 'cssmin', 'uglify', 'bower:install']);
    grunt.registerTask('default', ['srcs']);
};
