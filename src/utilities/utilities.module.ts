import { Module } from "@nestjs/common";
import { StreamProcessingUtility } from "./stream-processing-utility.service";

@Module({
  providers: [StreamProcessingUtility],
  exports: [StreamProcessingUtility],
})
export class UtilitiesModule {}
