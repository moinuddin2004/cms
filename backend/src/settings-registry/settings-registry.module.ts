import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigValue } from './entities/config-value.entity';
import { RedisSettingsCacheBus, SettingsCacheBus } from './settings-cache-bus';
import { SettingsRegistryService } from './settings-registry.service';
import { ThemeController } from './theme/theme.controller';
import { ThemeService } from './theme/theme.service';
import './theme/theme.settings'; // registers the theme.* keys

/**
 * `config_values` settings registry (theme + long-tail settings). Global so
 * any module can read a setting without importing this one.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ConfigValue])],
  controllers: [ThemeController],
  providers: [
    SettingsRegistryService,
    ThemeService,
    { provide: SettingsCacheBus, useClass: RedisSettingsCacheBus },
  ],
  exports: [SettingsRegistryService, ThemeService],
})
export class SettingsRegistryModule {}
