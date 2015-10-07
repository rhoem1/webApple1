/**
 * Apple 1 Hardware emulation
 *
 *
 * @copyright Robert Hoem 2015
 * @website
 * @license 2-term BSD
 *
 */




/**
 * Apple One Emulation
 */
var AppleOne = function(cpu, terminal) {

	// the entire 0xD000 block is for emulated hardware
	// ioPages is used to block out all of $D000
	// so things like msbasic can autodetect available memory
	var ioPages = cpu.romIntercept;
	cpu.addInterceptRange(0xD000, 0x1000, ioPages);


	// wire up pia intercepts


	/**
	 * the PIA is made up of 4 memory intercepts
	 *
	 * KB    (keyboard input)
	 */
	var miPIAKB = cpu.newMemoryIntercept(
		function(address) {
			checkKeyboard(true);

			// reset the control register
			miPIAKBcr.reg = 0;
			miPIAKBcr.counter = 10;

			return miPIAKB.reg;
		},
		function(value, address) {
			miPIAKB.reg = value;
		}
	);
	miPIAKB.reg = 0;
	cpu.addIntercept(0xD010,miPIAKB);


	/*
	 *
	 * KBcr  (keyboard control, status)
	 */
	var miPIAKBcr = cpu.newMemoryIntercept(
		function(address) {
			checkKeyboard(false);
			return miPIAKBcr.reg;
		},
		function(value, address) {
			miPIAKBcr.reg = value;
		}
	);
	miPIAKBcr.reg = 0;
	miPIAKBcr.counter = 10;
	cpu.addIntercept(0xD011,miPIAKBcr);



	/*
	 * DSP   (display output)
	 */
	var miPIADSP = cpu.newMemoryIntercept(
		function(address) {
		},
		function(value, address) {
			outputDsp(value);
		}
	);
	cpu.addIntercept(0xD012,miPIADSP);

	/*
	 *
	 * DSPcr (display control, status)
	 */
	var miPIADSPcr = cpu.newMemoryIntercept(
		function(address) {
			return miPIADSPcr.reg;
		},
		function(value, address) {
			miPIADSPcr.reg = value;
		}
	);
	miPIADSPcr.reg = 0;
	cpu.addIntercept(0xD013,miPIADSPcr);

	// extra functions



	/*
	 * Random number generation
	 */
	var miRNG = cpu.newMemoryIntercept(
		function(address) {
			return Math.floor(Math.random() * 0x100) & 0xFF;
		},
		function(value, address) {
			// javascript won't let us set the seed
			//Math.srand(value);
		}
	);
	cpu.addIntercept(0xD01E,miRNG);


	/**
	 * cycle count reporting intercept
	 */
	var miCycleCounter = cpu.newMemoryIntercept(
		function(address) {
		return miCycleCounter.reg;
		},
		function(value, address) {
		}
	);
	miCycleCounter.reg = 0;
	miCycleCounter.update = function(cycles) {
		miCycleCounter.reg += cycles;
		miCycleCounter.reg &= 0xFF;
	};

	this.updateCycles = function(c) {
		miCycleCounter.update(c);
	}
	cpu.addIntercept(0xD01F,miCycleCounter);



	var width40 = false;
	var cursorX = 0;

	this.set40columnLimit = function(s) {
		width40 = s;
	}



	/**
	 * output something to stdout from DSP
	 * @arg unsigned char value
	 */
	function outputDsp(value) {

		// this needs to talk to the terminal window

		// ignore any value that does not have bit 8 set
		if(value == 0x7F) 
			return;



		value &= 0x7F;


		
		switch (value) {
			case 0x7F:
			case 0x08:
			case 0x5F:
				// Backspace, del, underline
				// apple 1 used underline for backspace
				//printf("%c %c",0x08,0x08);
				//fflush(stdout);
				terminal.write(String.fromCharCode(8) + " " + String.fromCharCode(8));
				if(width40)
					cursorX--;
				break;

			case 0x0A:
				break;
			case 0x0D:
				// End of Line
				//printf("\r\n");
				terminal.write("\r\n");
				if(width40)
					cursorX=0;
				break;
			default:
				// Character
				//printf("%c",value);
				//fflush(stdout);
				terminal.write(String.fromCharCode(value));
				if(width40)
					cursorX++;
				break;
		}
		if(width40 && cursorX == 40) {
			cursorX = 0;
			terminal.write("\r\n");
		}
	}

	/*
	 * this should check a buffer that collects
	 * keystrokes via the keydown events
	 */

	var keyBuffer = [];
	this.addKeypressToBuffer = function(c)  {
		keyBuffer.unshift(c);
	}


	/**
	 * check for input in keyBuffer
	 * @return bool
	 */
	function getKeyboardReady() {

		return keyBuffer.length > 0;
	}

	/**
	 * read from keyBuffer
	 */
	function getKeyboardData() {
		var c = keyBuffer.pop();
		c = c.charCodeAt(0);
		return c;
	}


	// buffer to hold keyboard data
	// string keyboardBuffer;

	/**
	 * check for input, set PIA KB/KBcr status
	 * called between opcodes, when KBcr is accessed
	 * and when KB is accessed
	 */
	function checkKeyboard(reading) {
		var c = '';

		if(getKeyboardReady()) {
			// set KBcr to character available
			miPIAKBcr.reg = 0xA7;

			// this only works when we're reading
			if(reading) {
				c = getKeyboardData();


				// mapping
				switch(c) {
					case 0x0A: // linefeed = carriage return
						c = 0x0D;
						break;
					case 0x7F: // delete, backspace = underline
					case 0x08:
						c = 0x5F;
						break;
					default: // uppercase it
						c = String.fromCharCode(c).toUpperCase().charCodeAt(0);
						break;
				}

				c |= 0x80;

			}
		}
		if(c > 127) { // if we set bit 8, update KB
			miPIAKB.reg = c;
		}
	}

}

