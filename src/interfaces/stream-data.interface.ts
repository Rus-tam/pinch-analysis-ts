export interface IStreamData {
  id: number;
  inletTemp: number;
  outletTemp: number;
  massFlow: number;
  heatCapacity: number;
  flowHeatCapacity: number;
  streamType: string;
  deltaT: number;
}
