import { IsArray } from "class-validator";
import { IStreamData } from "src/interfaces/stream-data.interface";
import { StreamDto } from "./stream.dto";

export class StreamDataDto {
  @IsArray()
  streams: StreamDto[];
}
