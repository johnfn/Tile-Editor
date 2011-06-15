/*jslint devel: true, browser: true, maxerr: 50, indent: 4 */
/*global clearInterval: false, clearTimeout: false, document: false, event: false, frames: false, history: false, Image: false, location: false, name: false, navigator: false, Option: false, parent: false, screen: false, setInterval: false, setTimeout: false, window: false, XMLHttpRequest: false */

var $ = $; /* make jslint shut up */

$(function () {
	var /* Constants */	
			REFRESH_RATE = 50,
			TILE_WIDTH = 16,
			/* Singleton objects */
			main_grid,
			mouse_listener,
	    key_listener;

	function contains(array, item) {
		return array.indexOf(item) !== -1;
	}
	/* The editable area. */
	function MainGrid(width_in_tiles) {
		var states = { OVERWORLD : 0, SINGLE : 1 },
				state = states.OVERWORLD,
				context = document.getElementById("main").getContext("2d"),
				current_map = {},
				draw_loop,
				width = width_in_tiles * TILE_WIDTH;

		/* Updates the grid's state */
		function set_state(new_state) {
			state = new_state;
		}

		/* Draws the 'overworld' (all maps) */
		function draw_overworld() {
			context.strokeRect(0, 0, 400, 400);
		}

		/* Draws an individual map. */
		function draw_single() {
			context.fillRect(0, 0, 400, 400);
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

		this.update = function (keys_state, mouse_state) {
			var Z = 90, X = 88;
			
			console.log(mouse_state);
			if (contains(keys_state, Z)) {
				set_state(states.OVERWORLD);				
			} else if (contains(keys_state, X)) {
				set_state(states.SINGLE);
			}
		};
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

			for (i; i < 255; i += 1) {
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
		var keys_state = key_listener.get_state()
		  , mouse_state = mouse_listener.get_state();

		main_grid.update(keys_state, mouse_state);
		main_grid.draw();
	}

	function init() {
		/* Listeners */
		key_listener = new KeyListener();
		mouse_listener = new MouseListener();

		/* Objects */
		main_grid = new MainGrid();

		setInterval(main_loop, REFRESH_RATE);
	}

	init();
});
