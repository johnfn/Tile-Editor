/*jslint devel: true, browser: true, maxerr: 50, indent: 4 */
/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false */

var $ = $; /* make jslint shut up about jQuery.*/

$(function () {
	var /* Constants */	
			REFRESH_RATE = 50,
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
				arr[i][j] = fn();
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
				} else if (relative === "left") {
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

	/* Contains all tiles that you can draw on the main grid */
	function Tilebox(context, width_in_tiles) {
		var TILEBOX_HEIGHT = 5,  /* in tiles */
				dim = { x : 0, y : 0, width : width_in_tiles * TILE_WIDTH, height : TILEBOX_HEIGHT * TILE_WIDTH };

		this.get_dim = function () {
			return { width : dim.width, height : dim.height };
		};

		this.set_position = function (position) {
			dim.x = position.x;
			dim.y = position.y;
		};

		this.draw = function () {
			context.strokeRect(dim.x, dim.y, dim.width, dim.height);
		};

		this.update = function (keys_state, mouse_state) {
			//Do something meaningful.
		};

		function init() {

		}

		init();
	}

	/* Manages the map data */
	function Data(map_width, overworld_width) {
		var data = {}, /* A 4D array: [overworld_x][overworld_y][map_x][map_y] */
				current_map;

		/* Makes a generic empty tile. */
		function make_empty_tile() {
			return {type: 0};
		}

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
				return make_2d_array(map_width, function () {
					return make_empty_tile();
				});
			});
		}

		init.apply(this); /* Bind this to the more natural value */
	}

	/* The editable area. */
	function MainGrid(context, width_in_tiles) {
		var states = { OVERWORLD : 0, SINGLE : 1 },
				state = states.OVERWORLD,
				data, /* all map data */
				current_map = {},
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

		/* Returns the dimension of the grid */
		this.get_dim = function () {
			return { width : dim.w, height : dim.h };
		};


		/* Renders a tile to the screen. TYPE and TO are dictionaries. TYPE should have keys {file, x_rel, y_rel}.
		 * TO should have keys context, x_rel, y_rel (where rel indicates a relative positions) */

		/* This should be the only function that deals with absolute coordinates. */
		function render_tile(type, to) {
			var ctx = to.context;

			ctx.fillStyle = "#00f";
			ctx.strokeRect(to.x_rel * TILE_WIDTH, to.y_rel * TILE_WIDTH, TILE_WIDTH, TILE_WIDTH);

			if (type.type === 0) {
				ctx.fillStyle = "#0f0";
			} else if (type.type === 1) {
				ctx.fillStyle = "#f00";
			}
			ctx.fillRect(to.x_rel * TILE_WIDTH, to.y_rel * TILE_WIDTH, TILE_WIDTH, TILE_WIDTH);
		}

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
					render_tile(data.get_tile(i, j), {x_rel : i, y_rel : j, context : context });
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
			var Z = 90, X = 88;
			
			if (contains(keys_state, Z)) {
				set_state(states.OVERWORLD);				
			} else if (contains(keys_state, X)) {
				set_state(states.SINGLE);
			}
		};

		/* Initializes all data */
		function init() {
			data = new Data(MAP_WIDTH, OVERWORLD_WIDTH);
		}

		init();
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
		main_grid = new MainGrid(context, MAP_WIDTH);
		tile_box = new Tilebox(context, MAP_WIDTH);

		positioner = new Positioner();

		main_grid.set_position(positioner.add_object(extend_object(main_grid.get_dim(), {id : "main_grid"}), "", ""));
		tile_box.set_position(positioner.add_object(extend_object(tile_box.get_dim(), {id : "toolbox"}), "main_grid", "right"));

		setInterval(main_loop, REFRESH_RATE);
	}

	init();
});
