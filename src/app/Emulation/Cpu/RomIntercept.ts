import Cpu from './Cpu';
import MemoryIntercept from "./MemoryIntercept";

/**
 * romIntercept
 * used to turn a section of memory into "ROM"
 */
export default class RomIntercept extends MemoryIntercept {
  startAddress: number;
  data: Array<number>;

  constructor(cpu: Cpu, startAddress: number, data: Array<number>) {
    super(cpu);
    this.startAddress = startAddress;
    this.data = data;
  }
  
  get length() {
    return this.data.length;
  }

  override read(address: number) {
    if (address >= this.startAddress && address < this.startAddress + this.data.length)
      return this.data[address - this.startAddress];
    return 0;
  }

  override write(value: number, address: number) {
    // I've handled the write
    return true;
  }
  
  copyIntoMemory() {
    let memAddress = this.startAddress;
    this.data.forEach((byte) => {
      this.cpu.memory[memAddress] = byte; 
      memAddress += 1;
    });
  }
}
