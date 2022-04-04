import { Module } from "@nestjs/common";
import { ExchangerSetupUtility } from "./exchanger-setup-utility.service";
import { StreamProcessingUtility } from "./stream-processing-utility.service";

@Module({
  providers: [StreamProcessingUtility, ExchangerSetupUtility],
  exports: [StreamProcessingUtility, ExchangerSetupUtility],
})
export class UtilitiesModule {}
