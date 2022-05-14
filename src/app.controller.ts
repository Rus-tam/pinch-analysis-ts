import { Body, Controller, Get, Post } from "@nestjs/common";
import { AppService } from "./app.service";
import { StreamDataDto } from "./dto/stream-data.dto";
import { StreamProcessingUtility } from "./utilities/stream-processing-utility.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService, private readonly streamProcUtil: StreamProcessingUtility) {}

  @Post()
  pinchPointFinder(@Body() streamsData: StreamDataDto) {
    const streams = this.streamProcUtil.streamTypeDefiner(streamsData);
    const { hotPinchPoint, coldPinchPoint, hotUtilitiesAmount, coldUtilitiesAmount } = this.appService.pinchPointFinder(streams);
    const { heatExchAbove, heatExchBelow, hotUtils, coldUtils } = this.appService.exchangerSetup(streams);

    console.log("Hot Pinch", hotPinchPoint);
    console.log("Cold Pinch", coldPinchPoint);
    console.log("Hot utilities", hotUtilitiesAmount);
    console.log("Cold Utilities", coldUtilitiesAmount);
    console.log("_____________________");

    console.log("Heat Exchangers Above", heatExchAbove);
    console.log("**********************");
    console.log("Heat Exchangers Below", heatExchBelow);
    console.log("**********************");
    console.log("Hot utils", hotUtils);
    console.log("***********************");
    console.log("Cold Utils", coldUtils);

    return {
      "Hot pinch point": hotPinchPoint,
      "Cold pinch point": coldPinchPoint,
      "Hot utilities": hotUtilitiesAmount,
      "Cold utilities": coldUtilitiesAmount,
      "Heat exchangers above": heatExchAbove,
      "Heat exchangers below": heatExchBelow,
      "Hot utils": hotUtils,
      "Cold utils": coldUtils,
    };
  }
}
