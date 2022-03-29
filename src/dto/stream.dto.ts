import { IsString, IsNumber } from "class-validator";

export class StreamDto {
  @IsNumber()
  id: number;

  @IsString()
  inletTemp: string;

  @IsString()
  outletTemp: string;

  @IsString()
  massFlow: string;

  @IsString()
  heatCapacity: string;

  @IsString()
  flowHeatCapacity: string;

  @IsString()
  streamType: string;

  @IsNumber()
  deltaT: number;
}
