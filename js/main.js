/**
 * Apple 1 in a Webpage Emulator
 *
 * @copyright Robert Hoem 2015
 * @website
 * @license 2-term BSD
 */

var Emulator = function() {

	// create computer emulation
	var cpu = new SixtyFiveCeeOhTwo(),
	WOZMON = new miWOZMON(),
	KRUSADER = new miKRUSADER(),
	IntBASIC = new miIntBASIC(),
	MSBASIC = new miMSBASIC(),

	aFrame = new AnimationFrame(),
	terminalWindow = document.getElementById('terminal'),
	button_reset = document.getElementById('reset_cpu'),
	button_nmi = document.getElementById('nmi_cpu'),
	button_intbasic = document.getElementById('load_intbasic'),
	button_msbasic = document.getElementById('load_msbasic'),
	button_assembler = document.getElementById('load_assembler'),
	load_input = document.getElementById('load_input'),
	load_text = document.getElementById('load_text'),
	terminal = new Terminal( {
		useFocus: true,
		useEvents: true,
		useMouse: false,
		colors: Terminal.colors,
		convertEol: false,
		termName: 'xterm',
		geometry: [80, 24],
		cursorBlink: true,
		visualBell: false,
		popOnBell: false,
		scrollback: 1000,
		screenKeys: false,
		debug: false,
		useStyle: true
	} ),
	hardware = new AppleOne(cpu,terminal);

	terminal.on('data',
		function(data) {
			var s = data.split('');
			for(var i = 0; i < s.length; ++i) {
				hardware.addKeypressToBuffer(s[i]);
			}
		}
	);


	terminal.open(terminalWindow);

	terminal.cursorHidden = false;
	terminal.cursorBlink = true;

	// set up event handlers for the buttons
	button_intbasic.addEventListener('click',
		function() {
			cpu.resetCpu();
			cpu.setPC(IntBASIC.start);

			button_intbasic.blur();
			terminal.focus(); // doesn't seem to get focus
		}
	);
	button_assembler.addEventListener('click', 
		function() {
			cpu.resetCpu();
			cpu.setPC(KRUSADER.start);
			button_assembler.blur();
			terminal.focus();
		}
	);

	button_msbasic.addEventListener('click', 
		function() {
			// mix in MSBasic
			MSBASIC.copyIntoMemory(cpu);
			cpu.resetCpu();
			cpu.setPC(MSBASIC.start);
			button_msbasic.blur();
			terminal.focus();
		}
	);


	
	button_reset.addEventListener('click', 
		function() {
			cpu.resetCpu();
			button_reset.blur();
			terminal.focus();
		}
	);
	button_nmi.addEventListener('click', 
		function() {
			cpu.nmiInterruptCpu();
			button_nmi.blur();
			terminal.focus();
		}
	);

	load_text.addEventListener('click',
		function() {
			var s = load_input.value.split('');
			for(var i = 0; i < s.length; ++i) {
				hardware.addKeypressToBuffer(s[i]);
			}
			load_text.blur();
			terminal.focus();
		}
	);



	var start = null;
	var emulateFrame = function(timestamp) {
		if (!start) start = timestamp;
		var progress = timestamp - start;
		start = timestamp;
		// the main loop
		var cyclesLeft = Math.floor(progress * 1000);
		if(cyclesLeft < 20000000)
		while(cyclesLeft > 0)  {

			// run an op, get the cycles used
			var cycles = cpu.do_op();

		//	console.log(cpu.dumper.cpuState());

			// pass the cycles used to things that need to know
			hardware.updateCycles(cycles);
			cyclesLeft -= cycles;

		}

		aFrame.request(emulateFrame);

	}


	// add ROMS
	// first comes the WOZ monitor
	cpu.addInterceptRange(WOZMON.start, WOZMON.length, WOZMON);

	// allow vectors to be set by programs
	cpu.addInterceptRange(0xFFF8,8,0);

	// copy the vectors from WOZMON into memory
	for(var i = WOZMON.length - 8; i < WOZMON.length; ++i) {
		cpu.writeMemory(0xFF00 + i, WOZMON.monitor[i]);
	}

	// mix in IntBasic
	cpu.addInterceptRange(IntBASIC.start, IntBASIC.length, IntBASIC);
	// mix in Krusader
	cpu.addInterceptRange(KRUSADER.start, KRUSADER.length, KRUSADER);
	// set NMI to hop into Krusader's debugger
	cpu.writeMemory(0xFFFE, 0x19);
	cpu.writeMemory(0xFFFF, 0xFE);

	// reset and run WOZMON
	cpu.resetCpu();

	//console.log(cpu.dumper.cpuStateHeader());

	aFrame.request(emulateFrame);

	terminal.focus();
	terminal.startBlink();
	terminal.showCursor();
}

 
window.addEventListener('load', function() {
	var emu = new Emulator();
});
