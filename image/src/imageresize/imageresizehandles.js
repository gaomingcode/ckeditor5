/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module image/imageresize/imageresizehandles
 */

import { Plugin } from 'ckeditor5/src/core';
import { WidgetResize } from 'ckeditor5/src/widget';

import ImageLoadObserver from '../image/imageloadobserver';

const RESIZABLE_IMAGES_CSS_SELECTOR = 'figure.image.ck-widget > img,' +
	'figure.image.ck-widget > a > img,' +
	'span.image-inline.ck-widget > img';

const IMAGE_WIDGETS_CLASSES_MATCH_REGEXP = /(image|image-inline)/;

/**
 * The image resize by handles feature.
 *
 * It adds the ability to resize each image using handles or manually by
 * {@link module:image/imageresize/imageresizebuttons~ImageResizeButtons} buttons.
 *
 * @extends module:core/plugin~Plugin
 */
export default class ImageResizeHandles extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ WidgetResize ];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'ImageResizeHandles';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const command = this.editor.commands.get( 'resizeImage' );
		this.bind( 'isEnabled' ).to( command );

		this._setupResizerCreator();
	}

	/**
	 * Attaches the listeners responsible for creating a resizer for each image, except for images inside the HTML embed preview.
	 *
	 * @private
	 */
	_setupResizerCreator() {
		const editor = this.editor;
		const editingView = editor.editing.view;

		editingView.addObserver( ImageLoadObserver );

		this.listenTo( editingView.document, 'imageLoaded', ( evt, domEvent ) => {
			// The resizer must be attached only to images loaded by the `ImageInsert`, `ImageUpload` or `LinkImage` plugins.
			if ( !domEvent.target.matches( RESIZABLE_IMAGES_CSS_SELECTOR ) ) {
				return;
			}

			const domConverter = editor.editing.view.domConverter;
			const imageView = domConverter.domToView( domEvent.target );
			const widgetView = imageView.findAncestor( { classes: IMAGE_WIDGETS_CLASSES_MATCH_REGEXP } );
			let resizer = this.editor.plugins.get( WidgetResize ).getResizerByViewElement( widgetView );

			if ( resizer ) {
				// There are rare cases when the image will be triggered multiple times for the same widget, e.g. when
				// the image's source was changed after upload (https://github.com/ckeditor/ckeditor5/pull/8108#issuecomment-708302992).
				resizer.redraw();

				return;
			}

			const mapper = editor.editing.mapper;
			const imageModel = mapper.toModelElement( widgetView );

			resizer = editor.plugins
				.get( WidgetResize )
				.attachTo( {
					unit: editor.config.get( 'image.resizeUnit' ),

					modelElement: imageModel,
					viewElement: widgetView,
					editor,

					getHandleHost( domWidgetElement ) {
						return domWidgetElement.querySelector( 'img' );
					},
					getResizeHost() {
						// Return the model image element parent to avoid setting an inline element (<a>/<span>) as a resize host.
						return domConverter.viewToDom( mapper.toViewElement( imageModel.parent ) );
					},
					// TODO consider other positions.
					isCentered() {
						const imageStyle = imageModel.getAttribute( 'imageStyle' );

						return !imageStyle || imageStyle == 'full' || imageStyle == 'alignCenter';
					},

					onCommit( newValue ) {
						editor.execute( 'resizeImage', { width: newValue } );
					}
				} );

			resizer.on( 'updateSize', () => {
				if ( !widgetView.hasClass( 'image_resized' ) ) {
					editingView.change( writer => {
						writer.addClass( 'image_resized', widgetView );
					} );
				}
			} );

			resizer.bind( 'isEnabled' ).to( this );
		} );
	}
}
