import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDomainDto {
  @ApiProperty({ example: 'texcraft.in', description: 'Domain name to onboard' })
  @IsString()
  @IsNotEmpty()
  domainName!: string;

  @ApiPropertyOptional({ example: 'mail.nitechspark.site' })
  @IsString()
  @IsOptional()
  imapHost?: string;

  @ApiPropertyOptional({ example: 993 })
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  imapPort?: number;

  @ApiPropertyOptional({ example: 'mail.nitechspark.site' })
  @IsString()
  @IsOptional()
  smtpHost?: string;

  @ApiPropertyOptional({ example: 587 })
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  smtpPort?: number;
}
