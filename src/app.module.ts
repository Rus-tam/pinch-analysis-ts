import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { UtilitiesModule } from "./utilities/utilities.module";

@Module({
  imports: [UtilitiesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
