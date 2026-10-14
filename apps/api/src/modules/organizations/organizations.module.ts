import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { OrganizationProfileController } from "./organization-profile.controller";
import { OrganizationProfileService } from "./organization-profile.service";
import { OrganizationRequisitesController } from "./organization-requisites.controller";
import { OrganizationRequisitesService } from "./organization-requisites.service";

@Module({ controllers: [OrganizationsController, OrganizationProfileController, OrganizationRequisitesController], providers: [OrganizationsService, OrganizationProfileService, OrganizationRequisitesService], exports: [OrganizationProfileService] })
export class OrganizationsModule {}
