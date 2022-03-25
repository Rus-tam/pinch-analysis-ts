export interface IIntervals {
  id: number;
  start: number;
  end: number;
  deltaT: number;
  streamId: number[];
  heatCapDivision: number;
  deltaH: number;
  heatStatus: string;
  incomingHeat: number;
  outgoingHeat: number;
}
