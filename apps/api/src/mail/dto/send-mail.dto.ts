import {
  IsString,
  IsEmail,
  IsArray,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMailDto {
  @ApiProperty()
  @IsString()
  mailAccountId!: string;

  @ApiProperty({ type: [String], example: ['recipient@example.com'] })
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMaxSize(50)
  to!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMaxSize(25)
  cc?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  @ArrayMaxSize(25)
  bcc?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(998) // RFC 5322 max
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  attachmentIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inReplyTo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  references?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  signatureId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}
