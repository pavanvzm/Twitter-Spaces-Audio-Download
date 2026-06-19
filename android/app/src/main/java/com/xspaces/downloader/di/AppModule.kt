package com.xspaces.downloader.di

import android.content.Context
import com.xspaces.downloader.data.repository.AuthRepository
import com.xspaces.downloader.data.repository.DownloadRepository
import com.xspaces.downloader.data.repository.SpaceRepository
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAuthRepository(
        @ApplicationContext context: Context
    ): AuthRepository {
        return AuthRepository(context)
    }

    @Provides
    @Singleton
    fun provideSpaceRepository(): SpaceRepository {
        return SpaceRepository()
    }

    @Provides
    @Singleton
    fun provideDownloadRepository(
        @ApplicationContext context: Context
    ): DownloadRepository {
        return DownloadRepository(context)
    }
}
