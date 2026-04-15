export class TokensDto {
  accessToken: string;
  refreshToken?: string;
  sessionId?: string;

  public static toDto(accessToken, refreshToken, sessionId?): TokensDto {
    return {
      accessToken: accessToken,
      refreshToken: refreshToken,
      sessionId: sessionId
    }
  }
}