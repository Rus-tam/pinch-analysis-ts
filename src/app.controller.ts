import { Body, Controller, Get, Post } from "@nestjs/common";
import { AppService } from "./app.service";
import { StreamDataDto } from "./dto/stream-data.dto";
import { StreamProcessingUtility } from "./utilities/stream-processing-utility.service";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly streamProcUtil: StreamProcessingUtility,
  ) {}

  @Post()
  pinchPointFinder(@Body() streamsData: StreamDataDto) {
    const streams = this.streamProcUtil.streamTypeDefiner(streamsData);
    const { hotPinchPoint, coldPinchPoint, hotUtilitiesAmount, coldUtilitiesAmount } =
      this.appService.pinchPointFinder(streams);

    console.log("Hot Pinch", hotPinchPoint);
    console.log("Cold Pinch", coldPinchPoint);
    console.log("Hot utilities", hotUtilitiesAmount);
    console.log("Cold Utilities", coldUtilitiesAmount);
    console.log("_____________________");
    // console.log(streams);

    this.appService.exchangerSetup(streams);
  }
}
