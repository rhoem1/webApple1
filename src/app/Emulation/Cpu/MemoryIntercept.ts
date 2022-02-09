import Cpu from './Cpu';



export default class MemoryIntercept {
  cpu: Cpu;
  constructor(cpu: Cpu) {
    this.cpu = cpu;
  }
  read(address: number) {
    return this.cpu.memory[address];
  }
  write(value: number, address: number) {
    this.cpu.memory[address] = value;
  }
}
