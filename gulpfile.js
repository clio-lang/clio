var     browserify = require('browserify'),
        buffer     = require('vinyl-buffer'),
        gulp       = require('gulp'),
        livereload = require('gulp-livereload'),
        merge      = require('merge'),
        rename     = require('gulp-rename'),
        source     = require('vinyl-source-stream'),
        disc       = require('disc'),
        watchify   = require('watchify'),
        fs         = require('fs'),
        terser     = require('gulp-terser');

var config = {
    js: {
        src: './index.js',                      // Entry point
        browser: './browser.js',                // Browser entry point
        outputDir: '../clio-editor/',           // Directory to save bundle to
        outputFile: 'clio.js',                  // Name to use for bundle
        bundlePath: '../clio-editor/clio.js',   // To be used with disc
        disc: '../clio-editor/breakdown.html',  // Name to use for disc
    },
};

// This method makes it easy to use common bundling options in different tasks
function bundle (bundler) {
  // Add options to add to "base" bundler passed as parameter
  return bundler
    .bundle()                                    // Start bundle
    .pipe(source(config.js.browser))             // Entry point
    .pipe(buffer())                              // Convert to gulp pipeline
    .pipe(terser())                              // Uglify
    .pipe(rename(config.js.outputFile))          // Rename output to 'clio.js'
    .pipe(gulp.dest(config.js.outputDir))        // Save 'bundle' to editor/
}

function discify () {
  return fs
    .createReadStream(config.js.bundlePath)
    .pipe(disc())
    .pipe(fs.createWriteStream(config.js.disc));
}


gulp.task('bundle', function () {
    make_bundler = function () {
      return browserify(config.js.browser, {
        fullPaths: true
      })  // Pass browserify the entry point
    }
    bundle(make_bundler());  // Chain other options -- sourcemaps, rename, etc.
    return discify();        // Chain other options -- sourcemaps, rename, etc.
})
