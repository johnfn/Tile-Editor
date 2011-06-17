/*jslint devel: true, browser: true, maxerr: 50, indent: 4 */
/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false */

var $ = $; /* make jslint shut up about jQuery.*/

$(function () {
	var /* Constants */	
			REFRESH_RATE = 10,
			/* Currently constants, but won't be later */
			TILE_WIDTH = 20,
			MAP_WIDTH = 20,
			OVERWORLD_WIDTH = 20,
			/* Singleton objects */
			main_grid,
			mouse_listener,
	    key_listener,
			positioner,
			tile_box;

	/*********************
	 * Utility functions *
	 *********************/

	/* does ARRAY contain ITEM? */
	function contains(array, item) {
		return array.indexOf(item) !== -1;
	}

	/* Create a 2d array of size SIZE by SIZE, whose elements contain the return value of FN. 
	 *
	 * We take a function, not a value, just in case the user tries to pass in something like {}. */
	function make_2d_array(size, fn) {
		var arr = [], i = 0, j = 0;
		for (i = 0; i < size; i += 1) {
			arr[i] = [];
			for (j = 0; j < size; j += 1) {
				arr[i][j] = fn(i, j);
			}
		}
		return arr;
	}

	/* apply FN to every element of ARRAY, returning a new array. */
	function map_2d(array, fn) {
		var i = 0, j = 0, new_array = array;

		for (i = 0; i < array.length; i += 1) {
			for (j = 0; j < array.length; j += 1) {
				new_array = fn(array[i][j]);
			}
		}

		return new_array;
	}

	/* Standard functional map function */
	function map(array, fn) {
		var result, i = 0;

		for (i = 0; i < array.length; i += 1) {
			result[i] = fn(array[i]);
		}
	}

	/* Give OBJ properties from EXTRAS */
	function extend_object(obj, extras) {
		var prop;

		for (prop in extras) {
			if (extras.hasOwnProperty(prop)) {
				obj[prop] = extras[prop];
			}
		}

		return obj;
	}

	/* is point POINT inside rect RECT? */
	function point_inside_rect(point, rect) {
		return (point.x >= rect.x && point.x <= rect.x + rect.width &&
						point.y >= rect.y && point.y <= rect.y + rect.height);
	}

	/* Return elem for which fn(elem) is the highest value. It is assumed that f(x) >= 0 for all x */
	function max(array, fn) {
		var best_score = -1, best_object = {}, i = 0;

		for (i = 0; i < array.length; i += 1) {
			if (fn(array[i]) > best_score) {
				best_object = array[i];
			}
		}

		return best_object;
	}
	
	/*
	 * Singleton classes
	 */

	/* Finds positions for boxes ( {width, height} ) to be placed. Stateful. */
	function Positioner() {
		var objects_positioned = {},
		    BORDER_WIDTH = 10;

		/* example: add_object({width: 50, height: 50, id: "new_box"}, "main", "right")) 
		 *
		 * The primary (and only) exported function of Positioner. Takes a new object's 
		 * dimensions, an object to be positioned relative to, and which side to be positioned
		 * on, and returns a suitable x and y coordinate of the new object. */
		this.add_object = function (obj, other_object, relative) {
			var new_object = {},
			    parent_object = objects_positioned[other_object];

			new_object.width = obj.width;
			new_object.height = obj.height;

			if (other_object === "") {
				/* The object has no parent. */
				new_object.x = 0;
				new_object.y = 0;
			} else {
				if (relative === "right") {
					new_object.x = parent_object.x + parent_object.width + BORDER_WIDTH;
					new_object.y = parent_object.objs_on_right;

					parent_object.objs_on_right += new_object.height + BORDER_WIDTH;
				} else if (relative === "bottom") {
					new_object.x = parent_object.objs_on_bottom;
					new_object.y = parent_object.x + parent_object.width + BORDER_WIDTH;

					parent_object.objs_on_bottom += new_object.width + BORDER_WIDTH;
				}
			}

			new_object.objs_on_bottom = new_object.x;
			new_object.objs_on_right = new_object.y;

			objects_positioned[obj.id] = new_object;

			return { x : new_object.x, y : new_object.y };
		};
	}

	/* Any tile that appears onscreen (or can potentially appear on screen) */
	function Tile(x_rel, y_rel, container, type) {
		this.container = container;
		this.x_rel = x_rel; /* (Relative) coordinates of tile */
		this.y_rel = y_rel;

		Tile.prototype.get_top_left = function () {
			return this.container.get_position();
		};

		/* Renders a tile to the screen. TYPE and TO are dictionaries.
		 * TO should have keys context, x_rel, y_rel (where rel indicates a relative positions) */

		/* This should be the only function that deals with absolute coordinates. */

		/* TODO: Use get_dim in this function */
		Tile.prototype.render = function (to) {
			var top_left = this.get_top_left(),
			    ctx = to.context;

			ctx.fillStyle = "#00f";
			ctx.strokeRect(top_left.x + this.x_rel * TILE_WIDTH, top_left.y + this.y_rel * TILE_WIDTH, TILE_WIDTH, TILE_WIDTH);

			if (this.type === 0) {
				ctx.fillStyle = "#0f0";
			} else if (this.type === 1) {
				ctx.fillStyle = "#f00";
			}
			ctx.fillRect(top_left.x + this.x_rel * TILE_WIDTH, top_left.y + this.y_rel * TILE_WIDTH, TILE_WIDTH, TILE_WIDTH);
		}

		Tile.prototype.get_dim = function () {
			var top_left = this.get_top_left();

			return { x : top_left.x + this.x_rel * TILE_WIDTH, y : top_left.y + this.y_rel * TILE_WIDTH, width : TILE_WIDTH, height : TILE_WIDTH };
		}

		Tile.prototype.contains = function (point) {
			return point_inside_rect(point, this.get_dim());
		}

		if (!type) {
			/* default type */
			this.type = 0;
		} else {
			this.type = type;
		}
	}

	/* Contains all tiles that you can draw on the main grid */
	function Tilebox(context, width_in_tiles) {
		var TILEBOX_HEIGHT = 5,  /* in tiles */
				current_selection = 0, /* index into tiles[] */
				tiles,
				dim = { x : 0, y : 0, width : width_in_tiles * TILE_WIDTH, height : TILEBOX_HEIGHT * TILE_WIDTH };

		this.get_dim = function () {
			return dim; 
		};

		/* Get the top left corner of the tile box */
		this.get_position = function () {
			return dim;
		}

		/* Returns a new object of the selected type */
		this.selection_to_tile = function (x_rel, y_rel, tile_parent) {
			return new Tile(x_rel, y_rel, tile_parent, current_selection);
		}

		this.set_position = function (position) {
			dim.x = position.x;
			dim.y = position.y;
		};

		this.draw = function () {
			var i = 0;

			for (i = 0; i < tiles.length; i++) {
				tiles[i].render({ context : context });
			}

			context.strokeRect(dim.x, dim.y, dim.width, dim.height);
		};

		this.update = function (keys_state, mouse_state) {
			var i = 0;

			if (mouse_state.down) {
				for (i = 0; i < tiles.length; i++) {
					if (tiles[i].contains(mouse_state)){
						current_selection = i;
					}
				}
			}
		};

		tiles = [new Tile(0, 0, this, 0), new Tile(1, 0, this, 1)];
	}

	/* Manages the map data */
	function Data(map_width, overworld_width, container) {
		var data = {}, /* A 4D array: [overworld_x][overworld_y][map_x][map_y] */
				current_map;

		/* Returns the map currently being edited */
		function get_current_map() {
			return data[current_map[0]][current_map[1]];
		}

		/* Change a tile of the current map */
		this.set_tile = function (x, y, content) {
			var cur_map = get_current_map();
			cur_map[x][y] = content;
		};

		this.get_tile = function (x, y) {
			var cur_map = get_current_map();
			return cur_map[x][y];
		};

		/* Change which map we're editing */
		this.set_current_map = function (x, y) {
			current_map = [x, y];
		};

		/* initialize the map data */
		function init() {
			var i = 0, j = 0;

			this.set_current_map(0, 0);

			/* Make a 4D array. This is O(scary)...but it seems fine. */
			data = make_2d_array(overworld_width, function () {
				return make_2d_array(map_width, function (i, j) {
					return new Tile(i, j, container);
				});
			});
		}

		init.apply(this); /* Bind this to the more natural value */
	}

	/* The editable area. */
	function MainGrid(context, width_in_tiles, tile_box) {
		var states = { OVERWORLD : 0, SINGLE : 1 },
				state = states.OVERWORLD,
				data, /* all map data */
				current_map = {},
				tile_box = tile_box,
				draw_loop,
				dim = { x : 0, y : 0, w : width_in_tiles * TILE_WIDTH, h : width_in_tiles * TILE_WIDTH };


		/* Updates the grid's state */
		function set_state(new_state) {
			state = new_state;
		}

		this.set_position = function (position) {
			dim.x = position.x;
			dim.y = position.y;
		};

		/* Get the top left corner of the tile box */
		this.get_position = function () {
			return { x : dim.x, y : dim.y };
		}

		/* Returns the dimension of the grid */
		this.get_dim = function () {
			return { width : dim.w, height : dim.h };
		};

		/* Draws the 'overworld' (all maps) */
		function draw_overworld() {
			context.strokeRect(dim.x, dim.y, dim.w, dim.h);
		}

		/* Draws an individual map. */
		function draw_single() {
			var i = 0, j = 0;
			context.strokeRect(dim.x, dim.y, dim.w, dim.h);

			for (i = 0; i < width_in_tiles; i += 1) {
				for (j = 0; j < width_in_tiles; j += 1) {
					data.get_tile(i, j).render({ context : context });
				}
			}
		}

		/* Generic drawing function */
		this.draw = function () {
			/* Expand the canvas to take up the whole window. */
			context.canvas.width  = window.innerWidth;
			context.canvas.height = window.innerHeight;

			context.clearRect(0, 0, context.canvas.width, context.canvas.height);

			if (state === states.OVERWORLD) {
				draw_overworld();
			} else if (state === states.SINGLE) {
				draw_single(current_map);
			}
		};

		/* Takes states of input, and changes internal state if necessary. */
		this.update = function (keys_state, mouse_state) {
			var i = 0, j = 0, 
					Z = 90, X = 88; /* Keycodes */
			
			if (contains(keys_state, Z)) {
				set_state(states.OVERWORLD);				
			} else if (contains(keys_state, X)) {
				set_state(states.SINGLE);
			}

			if (mouse_state.down) {
				for (i = 0; i < width_in_tiles; i += 1) {
					for (j = 0; j < width_in_tiles; j += 1) {
						if (data.get_tile(i, j).contains(mouse_state)) {
							data.set_tile(i, j, tile_box.selection_to_tile(i, j, this));
						}
					}
				}
			}
		};

		/* Initializes all data */
		function init() {
			data = new Data(MAP_WIDTH, OVERWORLD_WIDTH, this);
		}

		init.apply(this);
	}

	/* A key listener module. get_state returns an array of all keys that are currently pressed. */
	function KeyListener() {
		var keys_state = {};
		
		$("body").keydown(function (e) {
			keys_state[e.which] = true;
		});

		$("body").keyup(function (e) {
			keys_state[e.which] = false;
		});

		this.get_state = function () {
			var i = 0, down = [];

			for (i = 0; i < 255; i += 1) {
				if (keys_state[i]) {
					down.push(i);
				}
			}

			return down;
		};
	}

	/* Mouse listener module. get_state returns the current state of the mouse */
	function MouseListener() {
		var mouse_state = {x : 0, y : 0, down : false};

		$("body").mousemove(function (e) {
			mouse_state.x = e.pageX;
			mouse_state.y = e.pageY;
		});

		$("body").mousedown(function (e) {
			mouse_state.down = true;
		});

		$("body").mouseup(function (e) {
			mouse_state.down = false;
		});

		this.get_state = function () {
			return mouse_state;
		};
	}


	function main_loop() {
		var keys_state = key_listener.get_state(),
		    mouse_state = mouse_listener.get_state();

		main_grid.update(keys_state, mouse_state);
		main_grid.draw();

		tile_box.update(keys_state, mouse_state);
		tile_box.draw();
	}

	function init() {
		var context = document.getElementById("main").getContext("2d");

		/* Listeners */
		key_listener = new KeyListener();
		mouse_listener = new MouseListener();

		/* Objects */
		tile_box = new Tilebox(context, MAP_WIDTH);
		main_grid = new MainGrid(context, MAP_WIDTH, tile_box);

		positioner = new Positioner();

		main_grid.set_position(positioner.add_object(extend_object(main_grid.get_dim(), {id : "main_grid"}), "", ""));
		tile_box.set_position(positioner.add_object(extend_object(tile_box.get_dim(), {id : "toolbox"}), "main_grid", "bottom"));

		setInterval(main_loop, REFRESH_RATE);
	}

	init();
});
