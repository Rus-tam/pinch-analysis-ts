import { IsString, IsNumber } from "class-validator";

export class StreamDto {
  @IsNumber()
  id: number;

  @IsNumber()
  inletTemp: number;

  @IsNumber()
  outletTemp: number;

  @IsNumber()
  massFlow: number;

  @IsNumber()
  heatCapacity: number;

  @IsNumber()
  flowHeatCapacity: number;

  @IsString()
  streamType: string;

  @IsNumber()
  deltaT: number;
}
