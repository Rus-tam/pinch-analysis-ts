import { IsArray } from "class-validator";
import { IStreamData } from "src/interfaces/stream-data.interface";

export class StreamDataDto {
  @IsArray()
  streams: IStreamData[];
}
