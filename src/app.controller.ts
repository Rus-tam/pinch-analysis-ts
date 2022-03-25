import { Body, Controller, Get, Post } from "@nestjs/common";
import { AppService } from "./app.service";
import { StreamDataDto } from "./dto/stream-data.dto";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  pinchPointFinder(@Body() streamsData: StreamDataDto) {
    const { hotPinchPoint, coldPinchPoint, hotUtilitiesAmount, coldUtilitiesAmount } =
      this.appService.pinchPointFinder(streamsData);

    console.log("Hot pinch point", hotPinchPoint);
    console.log("Cold pinch point", coldPinchPoint);
    console.log("Hot utilities", hotUtilitiesAmount);
    console.log("Cold utilities", coldUtilitiesAmount);
  }
}
