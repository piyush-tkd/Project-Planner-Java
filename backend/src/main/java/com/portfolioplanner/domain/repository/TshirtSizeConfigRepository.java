package com.portfolioplanner.domain.repository;

import com.portfolioplanner.domain.model.TshirtSizeConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TshirtSizeConfigRepository extends JpaRepository<TshirtSizeConfig, Long> {

    List<TshirtSizeConfig> findAllByOrderByDisplayOrderAsc();

    Optional<TshirtSizeConfig> findByName(String name);

    boolean existsByName(String name);
}
