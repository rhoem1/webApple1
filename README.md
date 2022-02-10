# webApple1
An Apple1 emulator using 65co2 cpu emulation, in javascript  
By Rob Hoem

[webApple1 Emulation][]

New version written using Angular, ported to Typescript

Wozmonitor, Integer BASIC, MS BASIC from [jefftrantor][]  
Krusader 1.3 from [krusader][]  
Terminal from [term.js][] (no longer maintained, es5 version) 

Control Buttons
---------------
* Reset
This will reset the emulation and drop the user into the Wozmonitor (at $FF00)
* NMI
This will trigger a non-maskable interrupt in the CPU.  Krusader's debugger will be started.
* Integer BASIC
Resets the CPU, then starts Integer BASIC (at $E000)
* MS BASIC
Copies MS BASIC to $400, resets the CPU, starts MS BASIC.  40959 Bytes free.
* Krusader
Resets the CPU, starts Krusader (at $F000)
* 40 Col
Toggles between 40 columns and 80.  Some software expected 40 columns.


Memory Map
----------
$00 Zero Page  
$01 Stack  
$02 Input Buffer for most things  
$03-$CF RAM  
$D0 Hardware I/O  
$E0 Integer Basic  
$F0 Krusader  
$FF Wozmonitor  

Emulated Hardware
-----------------
The Apple 1's VIA is not duplicated throught $D000.  It is only available as  
$D010 PIAKB  
$D011 PIAKBcr  
$D012 PIADSP  
$D013 PIADSPcr

A call to the browser's random number generator is found at  
$D01E RNG  
Reading this will return a random value from 0 to 255.

Notes
-----
The width of the terminal is not limited to 40 columns, so it is possible that certain programs may display incorrectly.

If you'd like to feed the emulation text from a text file, there is a textarea control
below the terminal.  The associated Load button will load the contents of the textarea
into the emulation via the keyboard input.  The code you see in this box is the BASIC
program AMAZING.BAS, a simple maze generator.  To run it, click the MS BASIC button, then
after the Bytes Free message, click the Load button.  The program is then transferred
into the BASIC interperter.  Type 'RUN' once it is loaded and generate a Maze.

The emulation now runs in a webWorker, and is very fast, as it no longer causes delays in the main browser thread.


[jefftrantor]: https://github.com/jefftranter/6502
[krusader]: http://school.anhb.uwa.edu.au/personalpages/kwessen/apple1/Krusader.htm
[term.js]: https://github.com/chjj/term.js
[webApple1 Emulation]: https://rhoem1.github.io/webApple1
