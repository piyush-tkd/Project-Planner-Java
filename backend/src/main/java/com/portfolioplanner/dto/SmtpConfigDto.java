package com.portfolioplanner.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for SMTP configuration.
 *
 * <p><strong>GET response:</strong> {@code password} is always {@code null};
 * {@code passwordSet} indicates whether a password has been stored.
 *
 * <p><strong>PUT request:</strong> if {@code password} is blank/null the stored
 * password is left unchanged; otherwise it is overwritten.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SmtpConfigDto {

    private String  host;
    private Integer port;
    private String  username;

    /** Never populated in GET responses — use {@code passwordSet} instead. */
    private String  password;

    /** True when a non-blank password has been saved. Populated in GET responses only. */
    private Boolean passwordSet;

    private String  fromAddress;
    private Boolean useTls;
    private Boolean enabled;
}
