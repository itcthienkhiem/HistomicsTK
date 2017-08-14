girderTest.importPlugin('jobs');
girderTest.importPlugin('worker');
girderTest.importPlugin('large_image');
girderTest.importPlugin('slicer_cli_web');
girderTest.importPlugin('HistomicsTK');

var app;
var geojsMap;
var imageId;

girderTest.promise.then(function () {
    $('body').css('overflow', 'hidden');
    girder.router.enabled(false);
    girder.events.trigger('g:appload.before');
    app = new girder.plugins.HistomicsTK.App({
        el: 'body',
        parentView: null
    });
    app.bindRoutes();
    girder.events.trigger('g:appload.after');
    return null;
});

$(function () {
    function openImage(name) {
        runs(function () {
            app.bodyView.once('h:viewerWidgetCreated', function (viewerWidget) {
                viewerWidget.once('g:beforeFirstRender', function () {
                    window.geo.util.mockVGLRenderer();
                });
            });
            $('.h-open-image').click();
        });

        girderTest.waitForDialog();

        runs(function () {
            $('#g-root-selector').val(
                girder.auth.getCurrentUser().id
            ).trigger('change');
        });

        waitsFor(function () {
            return $('#g-dialog-container .g-folder-list-link').length > 0;
        }, 'Hierarchy widget to render');

        runs(function () {
            $('.g-folder-list-link:contains("Public")').click();
        });

        waitsFor(function () {
            return $('.g-item-list-link').length > 0;
        }, 'item list to load');

        runs(function () {
            var $item = $('.g-item-list-link:contains("' + name + '")');
            imageId = $item.next().attr('href').match(/\/item\/([a-f0-9]+)\/download/)[1];
            expect($item.length).toBe(1);
            $item.click();
        });

        girderTest.waitForDialog();
        // Sometimes clicking submit fires the `g:saved` event, but doesn't actually
        // close the dialog.  Delaying the click seems to help.
        runs(function () {
            window.setTimeout(function () {
                $('.g-submit-button').click();
            }, 100);
        });

        girderTest.waitForLoad();
        waitsFor(function () {
            return $('.geojs-layer.active').length > 0;
        }, 'image to load');
        runs(function () {
            expect(girder.plugins.HistomicsTK.router.getQuery('image')).toBe(imageId);
        });
    }

    describe('setup', function () {
        it('login', function () {
            girderTest.waitForLoad();

            runs(function () {
                $('.g-login').click();
            });

            girderTest.waitForDialog();
            runs(function () {
                $('#g-login').val('admin');
                $('#g-password').val('password');
                $('#g-login-button').click();
            });

            waitsFor(function () {
                return $('.h-user-dropdown-link').length > 0;
            }, 'user to be logged in');
        });

        it('open image', function () {
            openImage('image');
            runs(function () {
                geojsMap = app.bodyView.viewer;
            });
        });
    });

    describe('Download view and region of interest', function () {
        it('check href attribute of \'Download View\' link', function () {
            runs(function () {
                $('#download-view-link').bind('click', function (event) {
                    event.preventDefault();
                });
                $('.h-download-button-view').click();
            });

            waitsFor(function () {
                return $('#download-view-link').attr('href') !== undefined;
            }, 'to be the url');

            runs(function () {
                expect($('#download-view-link').attr('href')).toMatch(/\/item\/[0-9a-f]{24}\/tiles\/region\?width=[0-9-]+&height=[0-9-]+&left=[0-9-]+&top=[0-9-]+&right=[0-9-]+&bottom=[0-9-]+&contentDisposition=attachment/);
            });
        });

        it('open the download dialog', function () {
            var interactor = geojsMap.interactor();
            $('.h-download-button-area').click();

            interactor.simulateEvent('mousedown', {
                map: {x: 100, y: 100},
                button: 'left'
            });
            interactor.simulateEvent('mousemove', {
                map: {x: 200, y: 200},
                button: 'left'
            });
            interactor.simulateEvent('mouseup', {
                map: {x: 200, y: 200},
                button: 'left'
            });

            girderTest.waitForDialog();
            runs(function () {
                expect($('.modal-title').text()).toBe('Edit Area');
            });
        });

        it('test modifying form elements', function () {
            const oldSettings = [];
            const elements = [];
            elements.push($('#h-element-width'), $('#h-element-height'),
                $('#nb-pixel'), $('#size-file'));
            oldSettings.push($('#h-element-width').val(), $('#h-element-height').val(),
                $('#nb-pixel').val(), $('#size-file').val());

            runs(function () {
                $('#h-element-mag').val(10).trigger('change');
                var i = 0;
                // Check all the setting labels change
                for (var value in oldSettings) {
                    expect(elements[i].val()).not.toEqual(value);
                    i++;
                }
            });

            runs(function () {
                $('#download-image-format').val('TIFF').trigger('change');
                // Check the size label change
                expect($('#size-file').val()).not.toEqual(oldSettings[3]);
            });
        });

        it('ensure the download link is correct', function () {
            waitsFor(function () {
                return $('#download-area-link').attr('href') !== undefined;
            }, 'to be the url');

            runs(function () {
                expect($('#download-area-link').attr('href')).toMatch(/\/item\/[0-9a-f]{24}\/tiles\/region\?regionWidth=[0-9-]+&regionHeight=[0-9-]+&left=[0-9-]+&top=[0-9-]+&right=[0-9-]+&bottom=[0-9-]+&encoding=[EFGIJNPT]{3,4}&contentDisposition=attachment&magnification=[0-9-]+/);
            });
        });

        it('close the dialog', function () {
            $('#g-dialog-container').girderModal('close');
            waitsFor(function () {
                return $('body.modal-open').length === 0;
            });
        });
    });

    describe('Annotation tests', function () {
        describe('Draw panel', function () {
            it('draw a point', function () {
                runs(function () {
                    $('.h-draw[data-type="point"]').click();
                });

                waitsFor(function () {
                    return $('.geojs-map.annotation-input').length > 0;
                }, 'draw mode to activate');
                runs(function () {
                    var interactor = geojsMap.interactor();
                    interactor.simulateEvent('mousedown', {
                        map: {x: 100, y: 100},
                        button: 'left'
                    });
                    interactor.simulateEvent('mouseup', {
                        map: {x: 100, y: 100},
                        button: 'left'
                    });
                });

                waitsFor(function () {
                    return $('.h-elements-container .h-element').length === 1;
                }, 'point to be created');
                runs(function () {
                    expect($('.h-elements-container .h-element .h-element-label').text()).toBe('point');
                });
            });

            it('edit a point element', function () {
                runs(function () {
                    $('.h-elements-container .h-edit-element').click();
                });

                girderTest.waitForDialog();
                runs(function () {
                    expect($('#g-dialog-container .modal-title').text()).toBe('Edit annotation');
                    $('#g-dialog-container #h-element-label').val('test');
                    $('#g-dialog-container .h-submit').click();
                });
                girderTest.waitForLoad();
                runs(function () {
                    expect($('.h-elements-container .h-element .h-element-label').text()).toBe('test');
                });
            });

            it('draw another point', function () {
                runs(function () {
                    $('.h-draw[data-type="point"]').click();
                });

                waitsFor(function () {
                    return $('.geojs-map.annotation-input').length > 0;
                }, 'draw mode to activate');
                runs(function () {
                    var interactor = geojsMap.interactor();
                    interactor.simulateEvent('mousedown', {
                        map: {x: 200, y: 200},
                        button: 'left'
                    });
                    interactor.simulateEvent('mouseup', {
                        map: {x: 200, y: 200},
                        button: 'left'
                    });
                });

                waitsFor(function () {
                    return $('.h-elements-container .h-element').length === 2;
                }, 'rectangle to be created');
                runs(function () {
                    expect($('.h-elements-container .h-element:last .h-element-label').text()).toBe('point');
                });
            });

            it('delete the second point', function () {
                $('.h-elements-container .h-element:last .h-delete-element').click();
                expect($('.h-elements-container .h-element').length).toBe(1);
            });

            it('save the point annotation', function () {
                var annotations = null;
                runs(function () {
                    $('.h-draw-widget .h-save-annotation').click();
                });

                girderTest.waitForDialog();
                runs(function () {
                    $('#g-dialog-container #h-annotation-name').val('single point');
                    $('#g-dialog-container .h-submit').click();
                });

                girderTest.waitForLoad();
                runs(function () {
                    expect($('.h-annotation-selector .h-annotation-name').text()).toBe('single point');
                    expect($('.h-draw-widget .h-save-widget').length).toBe(0);

                    girder.rest.restRequest({
                        path: 'annotation',
                        data: {
                            itemId: imageId
                        }
                    }).then(function (a) {
                        annotations = a;
                        return null;
                    });
                });

                waitsFor(function () {
                    return annotations !== null;
                }, 'get annotations from server');
                runs(function () {
                    expect(annotations.length).toBe(1);
                    expect(annotations[0].annotation.name).toBe('single point');
                });

                waitsFor(function () {
                    var $el = $('.h-annotation-selector .h-annotation:contains("single point")');
                    return $el.find('.icon-eye.h-toggle-annotation').length === 1;
                }, 'saved annotation to draw');
            });
        });

        describe('Annotation panel', function () {
            it('panel is rendered', function () {
                expect($('.h-annotation-selector .s-panel-title').text()).toMatch(/Annotations/);
            });

            it('toggle visibility of an annotation', function () {
                runs(function () {
                    var $el = $('.h-annotation-selector .h-annotation:contains("single point")');
                    $el.find('.h-toggle-annotation').click();
                });
                waitsFor(function () {
                    var $el = $('.h-annotation-selector .h-annotation:contains("single point")');
                    return $el.find('.icon-eye-off.h-toggle-annotation').length === 1;
                }, 'annotation to toggle off');

                runs(function () {
                    var $el = $('.h-annotation-selector .h-annotation:contains("single point")');
                    $el.find('.h-toggle-annotation').click();
                });
                waitsFor(function () {
                    var $el = $('.h-annotation-selector .h-annotation:contains("single point")');
                    return $el.find('.icon-eye.h-toggle-annotation').length === 1;
                }, 'annotation to toggle on');
            });

            it('delete an annotation', function () {
                var annotations = null;
                runs(function () {
                    $('.h-annotation-selector .h-annotation:contains("single point") .h-delete-annotation').click();
                    expect($('.h-annotation-selector .h-annotation:contains("single point")').length).toBe(0);
                });

                girderTest.waitForLoad();
                runs(function () {
                    girder.rest.restRequest({
                        path: 'annotation',
                        data: {
                            itemId: imageId
                        }
                    }).then(function (a) {
                        annotations = a;
                        return null;
                    });
                });

                waitsFor(function () {
                    return annotations !== null;
                }, 'get annotations from server');
                runs(function () {
                    expect(annotations.length).toBe(0);
                });
            });

            it('show new annotations during job events', function () {
                var uploaded = false;

                runs(function () {
                    var rect = {
                        'name': 'rectangle',
                        'elements': [
                            {
                                'center': [
                                    200,
                                    200,
                                    0
                                ],
                                'height': 100,
                                'rotation': 0,
                                'type': 'rectangle',
                                'width': 100
                            }
                        ]
                    };

                    girder.rest.restRequest({
                        path: 'annotation?itemId=' + imageId,
                        contentType: 'application/json',
                        processData: false,
                        data: JSON.stringify(rect),
                        type: 'POST'
                    }).then(function () {
                        uploaded = true;
                        return null;
                    });
                });

                waitsFor(function () {
                    return uploaded;
                }, 'annotation to be uploaded');
                runs(function () {
                    girder.utilities.eventStream.trigger('g:event.job_status', {
                        data: {status: 3}
                    });
                });

                waitsFor(function () {
                    return $('.h-annotation-selector .h-annotation:contains("rectangle")').length === 1;
                }, 'new annotation to appear');
                runs(function () {
                    var $el = $('.h-annotation-selector .h-annotation:contains("rectangle")');
                    expect($el.find('.icon-eye.h-toggle-annotation').length).toBe(1);
                });
            });

            it('open a different image', function () {
                openImage('copy');
                runs(function () {
                    expect($('.h-annotation-selector .h-annotation').length).toBe(0);
                });
            });

            it('open the original image', function () {
                openImage('image');
                runs(function () {
                    expect($('.h-annotation-selector .h-annotation').length).toBe(1);
                });
            });
        });
    });

    describe('Open recently annotated image', function () {
        it('open the dialog', function () {
            $('.h-open-annotated-image').click();
            girderTest.waitForDialog();
            runs(function () {
                var $el = $('.h-annotated-image[data-id="' + imageId + '"]');
                expect($el.length).toBe(1);
                expect($el.find('.media-left img').prop('src'))
                    .toMatch(/item\/[0-9a-f]*\/tiles\/thumbnail/);
                expect($el.find('.media-heading').text()).toBe('image');
            });
        });

        it('click on the image', function () {
            var $el = $('.h-annotated-image[data-id="' + imageId + '"]');
            $el.click();
            girderTest.waitForLoad();
            runs(function () {
                expect(girder.plugins.HistomicsTK.router.getQuery('image')).toBe(imageId);
            });
        });
    });
});
